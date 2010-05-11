package org.genepattern.server.executor;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Map.Entry;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import org.apache.log4j.Logger;
import org.genepattern.server.domain.JobStatus;
import org.genepattern.server.genepattern.GenePatternAnalysisTask;
import org.genepattern.webservice.JobInfo;

public class RuntimeCommandExecutor implements CommandExecutor {
    private static Logger log = Logger.getLogger(RuntimeCommandExecutor.class);
    
    private ExecutorService executor = null;

    //the total number of jobs which should be executing concurrently
    //TODO: enable setting this without requiring a server restart;
    //    at the moment you must restart your GP server to modify this setting
    private int numThreads = 20;

    public void setConfigurationFilename(String filename) {
        log.error("ignoring: setCofigurationFilename("+filename+")");
    }

    public void setConfigurationProperties(Properties properties) {
        setNumThreads(properties.getProperty("num.threads"));
    }
    
    private void setNumThreads(String numThreadsProp) {
        if (numThreadsProp == null || numThreadsProp.trim().length() == 0) {
            //expected
            numThreads = 20;
            return;
        }
        try {
            numThreads = Integer.parseInt(numThreadsProp);
        }
        catch (NumberFormatException e) {
            numThreads = 20;
            log.error("Invalid configuration property: num.threads="+numThreadsProp, e);
        }
    }
    
    //----- keep references to all currently running jobs which were started by this executor
    private Map<String,CallableRuntimeExecCommand> runningJobs = new HashMap<String,CallableRuntimeExecCommand>();

    public void start() {
        executor = Executors.newFixedThreadPool(numThreads);
    }

    public void stop() {
        executor.shutdown();
        terminateAll("--> Shutting down server");
        
        if (executor != null) {
            log.debug("stopping executor...");
            executor.shutdown();
            try {
                if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                    log.error("executor shutdown timed out after 30 seconds.");
                    executor.shutdownNow();
                }
            }
            catch (InterruptedException e) {
                log.error("executor.shutdown was interrupted", e);
                Thread.currentThread().interrupt();
            }
        }
    }
    
    private void terminateAll(String message) {
        //TODO: globally terminate all running pipelines
        //    pipelines used to be terminated here
        log.debug(message);        
        for(Entry<String, CallableRuntimeExecCommand> entry : runningJobs.entrySet()) {
            CallableRuntimeExecCommand cmd = entry.getValue();
            cmd.cancel();
            Thread.yield();
        }
    }

    public void runCommand(String[] commandLine,
            Map<String, String> environmentVariables, File runDir,
            File stdoutFile, File stderrFile, JobInfo jobInfo, String stdin,
            StringBuffer stderrBuffer) {
        
        String jobId = ""+jobInfo.getJobNumber();
        CallableRuntimeExecCommand task = new CallableRuntimeExecCommand(commandLine, environmentVariables, runDir, stdoutFile, stderrFile, jobInfo, stdin, stderrBuffer);
        runningJobs.put(jobId, task);
        try {
            Future<?> f = executor.submit(task);
            task.setFuture(f);
        }
        catch (RejectedExecutionException e) {
            //TODO: when the queue is full, reset the job status back to PENDING
            runningJobs.remove(jobId);
            stderrBuffer.append("job #"+jobId+" was not scheduled for execution");
            throw(e);
        }
        catch (Throwable t) {
            log.error("unexpected error starting job #"+jobId, t);
            runningJobs.remove(jobId);
        }
    }

    public void terminateJob(JobInfo jobInfo) {
        if (jobInfo == null) {
            log.error("null jobInfo");
            return;
        }
        String jobId = ""+jobInfo.getJobNumber();
        CallableRuntimeExecCommand cmd = runningJobs.get(jobId);
        if (cmd == null) {
            //terminateJob is called from deleteJob, so quite often terminateJob should have no effect
            log.debug("terminateJob("+jobInfo.getJobNumber()+"): job not running");
            return;
        }
        cmd.cancel();
    }
    
    private class CallableRuntimeExecCommand implements Callable<RuntimeExecCommand> 
    {
        private String[] commandLine = null;
        private Map<String, String> environmentVariables = null; 
        private File runDir = null;
        private File stdoutFile = null;
        private File stderrFile = null;
        private JobInfo jobInfo = null;
        private String stdin = null;
        private StringBuffer stderrBuffer = null;
        
        private RuntimeExecCommand cmd = null;
        
        private Future<?> future = null;
        public void setFuture(Future<?> f) {
            this.future = f;
        }

        public CallableRuntimeExecCommand(
                String[] commandLine,
                Map<String, String> environmentVariables, 
                File runDir,
                File stdoutFile, 
                File stderrFile, 
                JobInfo jobInfo, 
                String stdin,
                StringBuffer stderrBuffer) {
            this.commandLine = commandLine;
            this.environmentVariables = environmentVariables;
            this.runDir = runDir;
            this.stdoutFile = stdoutFile;
            this.stderrFile = stderrFile;
            this.jobInfo = jobInfo;
            this.stdin = stdin;
            this.stderrBuffer = stderrBuffer;
        }

        public RuntimeExecCommand call() throws Exception {
            cmd = new RuntimeExecCommand();
            cmd.runCommand(commandLine, environmentVariables, runDir, stdoutFile, stderrFile, jobInfo, stdin, stderrBuffer);
            String jobId = ""+jobInfo.getJobNumber();
            runningJobs.remove(jobId);
            int exitValue = cmd.getExitValue();
            int jobStatus = JobStatus.JOB_FINISHED;
            if (RuntimeExecCommand.Status.TERMINATED.equals( cmd.getInternalJobStatus() )) {
                jobStatus = JobStatus.JOB_ERROR;
            }
            if (exitValue != 0) {
                jobStatus = JobStatus.JOB_ERROR;
            }
            try {
                GenePatternAnalysisTask.handleJobCompletion(jobInfo.getJobNumber(), stdoutFile.getName(), stderrFile.getName(), exitValue, jobStatus);
            }
            catch (Exception e) {
                log.error("Error handling job completion for job "+jobInfo.getJobNumber(), e);
            }
            return cmd;
        }
        
        public void cancel() {
            if (cmd != null) {
                cmd.terminateProcess();
            }
            else {
                //special-case: job has not started
                if (future != null) {
                    future.cancel(false);
                }
                try {
                    GenePatternAnalysisTask.handleJobCompletion(jobInfo.getJobNumber(), stdoutFile.getName(), stderrFile.getName(), -1, JobStatus.JOB_ERROR);
                }
                catch (Exception e) {
                    log.error("Error terminating job "+jobInfo.getJobNumber(), e);
                }
            }
        }
    }
}
