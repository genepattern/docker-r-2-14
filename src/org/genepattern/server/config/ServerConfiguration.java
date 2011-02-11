package org.genepattern.server.config;

import java.io.File;

import org.apache.log4j.Logger;
import org.genepattern.server.executor.ConfigurationException;
import org.genepattern.webservice.JobInfo;

/**
 * Server configuration.
 * 
 * @author pcarr
 */
public class ServerConfiguration {
    private static Logger log = Logger.getLogger(ServerConfiguration.class);
    public static final String PROP_CONFIG_FILE = "command.manager.config.file";
    //TODO: change to public static final String PROP_CONFIG_FILE = "config.file";
    
    public static class Exception extends java.lang.Exception {
        public Exception() {
            super();
        }
        public Exception(String message) {
            super(message);
        }
        public Exception(String message, Throwable t) {
            super(message, t);
        }
    }

    public static class Context {
        //hard-coded default value is true for compatibility with GP 3.2.4 and earlier
        private boolean checkSystemProperties = true;
        //hard-coded default value is true for compatibility with GP 3.2.4 and earlier
        private boolean checkPropertiesFiles = true;
        private String userId = null;
        private JobInfo jobInfo = null;
        
        public static Context getServerContext() {
            Context context = new Context();
            return context;
        }

        public static Context getContextForUser(String userId) {
            Context context = new Context();
            if (userId != null) {
                context.setUserId(userId);
            }
            return context;
        }

        public static Context getContextForJob(JobInfo jobInfo) {
            Context context = new Context();
            if (jobInfo != null) {
                context.setJobInfo(jobInfo);
                if (jobInfo.getUserId() != null) {
                    context.setUserId(jobInfo.getUserId());
                }
            }
            return context;
        }
        
        public void setCheckSystemProperties(boolean b) {
            this.checkSystemProperties = b;
        }

        public boolean getCheckSystemProperties() {
            return checkSystemProperties;
        }

        public void setCheckPropertiesFiles(boolean b) {
            this.checkPropertiesFiles = b;
        }
        
        public boolean getCheckPropertiesFiles() {
            return checkPropertiesFiles;
        }
        
        public void setUserId(String userId) {
            this.userId = userId;
        }
        public String getUserId() {
            return userId;
        }
        
        public void setJobInfo(JobInfo jobInfo) {
            this.jobInfo = jobInfo;
        }
        public JobInfo getJobInfo() {
            return jobInfo;
        }
    }

    private static ServerConfiguration singleton = new ServerConfiguration();
    public static ServerConfiguration instance() {
        return singleton;
    }
    
    private ServerConfiguration() {
        try {
            reloadConfiguration();
        }
        catch (Throwable t) {
            log.error("Error creating ServerConfiguration instance: "+t.getLocalizedMessage());
        }
    }
    
    public synchronized void reloadConfiguration() throws ConfigurationException {
        String configFilePath = ServerProperties.instance().getProperty(PROP_CONFIG_FILE);
        if (configFilePath == null) {
            //TODO: change default config file name to "config.yml";
            configFilePath = "job_configuration.yaml";
            log.info(""+PROP_CONFIG_FILE+" not set, using default config file: "+configFilePath);
        }
        reloadConfiguration(configFilePath);
    }
    
    public synchronized void reloadConfiguration(String configFilePath) throws ConfigurationException {
        ConfigFileParser parser = new ConfigFileParser();
        parser.parseConfigFile(configFilePath);
        this.props = parser.getConfig();
        this.jobConfig = parser.getJobConfig();
    }
    
    private CommandManagerProperties props = new CommandManagerProperties();    
    private JobConfigObj jobConfig = new  JobConfigObj();
    public JobConfigObj getJobConfiguration() {
        return jobConfig;
    }

    /**
     * Utility method for parsing properties as a boolean.
     * The current implementation uses Boolean.parseBoolean, 
     * which returns true iff the property is set and equalsIgnoreCase 'true'.
     * 
     * @param key
     * @return
     */
    public boolean getGPBooleanProperty(Context context, String key) {
        String prop = getGPProperty(context, key);
        return Boolean.parseBoolean(prop);
    }
    
    /**
     * Utility method for parsing a property as an Integer.
     * 
     * When a non integer value is set in the config file, the default value is returned.
     * Errors are logged, but exceptions are not thrown.
     * 
     * @param key
     * @param defaultValue
     * 
     * @return the int value for the property, or the default value, can return null.
     */
    public Integer getGPIntegerProperty(Context context, String key, Integer defaultValue) {
        String val = getGPProperty(context, key);
        if (val == null) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(val);
        }
        catch (NumberFormatException e) {
            log.error("Error parsing integer value for property, "+key+"="+val);
            return defaultValue;
        }
    }

    public String getGPProperty(Context context, String key) {
        if (props == null) {
            log.error("Invalid server configuration in getGPProperty("+key+")");
            return null;
        }
        return props.getProperty(context, key);
    }
    
    //helper methods for locating server files and folders
    /**
     * Get the jobs directory. Each job runs in a new working directory. 
     * By default, the working directory is created in the root job dir for the server.
     * Edit the 'jobs' property to customize this location.
     */
    public File getRootJobDir(Context context) throws Exception {
        String jobsDir = getGPProperty(context, "jobs");
        if (jobsDir == null) {
            throw new Exception("Missing required propery, 'jobs'");
        }
        File rootJobDir = new File(jobsDir);
        return rootJobDir;
    }
    
    /**
     * Get the default data directory for the given user.
     * Requires a valid userId.
     * 
     * @param context
     * @return
     * @throws IllegalArgumentException
     */
    public File getUserUploadDir(Context context) throws IllegalArgumentException {
        if (context == null) {
            throw new IllegalArgumentException("context is null");
        }
        if (context.getUserId() == null) {
            throw new IllegalArgumentException("context.userId is null");
        }
        String userUploadDir = getGPProperty(context, "user.upload.root.dir");
        if (userUploadDir == null) {
            throw new IllegalArgumentException("The 'user.upload.root.dir' property is not set for this user: "+context.getUserId());
        }
        
        File root = new File(userUploadDir);
        File userDir = new File(root,context.getUserId());
        if (userDir.exists()) {
            return userDir;
        }
        boolean success = userDir.mkdir();
        if (!success) {
            throw new IllegalArgumentException("Unable to create upload directory for user "+context.getUserId()+", userDir="+userDir.getAbsolutePath());
        }
        return userDir;
    } 
}
