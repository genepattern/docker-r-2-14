package org.genepattern.server.rest;

import java.util.List;
import java.util.Map.Entry;

import org.apache.log4j.Logger;
import org.genepattern.server.config.ServerConfiguration.Context;
import org.genepattern.server.job.input.JobInputHelper;
import org.genepattern.server.job.input.JobInput;
import org.genepattern.server.job.input.JobInput.Param;
import org.genepattern.server.job.input.JobInput.ParamId;
import org.genepattern.server.job.input.JobInput.ParamValue;

public class BatchJobInputApiImpl implements JobInputApi {
    final static private Logger log = Logger.getLogger(BatchJobInputApiImpl.class);
    
    @Override
    public String postJob(Context jobContext, JobInput jobInput) throws GpServerException {
        try {
            JobReceipt receipt=postBatchJob(jobContext, jobInput);
            return receipt.getJobIds().get(0);
        }
        catch (Throwable t) {
            log.error(t);
            throw new GpServerException("Error preparing job", t);
        }
    }
    
    public JobReceipt postBatchJob(Context jobContext, JobInput jobInput) throws GpServerException {
        try {
            final JobReceipt receipt=doBatch(jobContext, jobInput);
            return receipt;
        }
        catch (Throwable t) {
            log.error(t);
            throw new GpServerException("Error preparing job", t);
        }
    }
    
    private JobReceipt doBatch(final Context userContext, final JobInput jobInput) throws GpServerException {
        try {
            JobInputHelper batchJobInput=new JobInputHelper(userContext, jobInput.getLsid());
            for(Entry<ParamId,Param> entry : jobInput.getParams().entrySet()) {
                ParamId paramId=entry.getKey();
                Param param=entry.getValue();
                if (param.isBatchParam()) {
                    batchJobInput.addBatchDirectory(paramId, param.getValues().get(0).getValue());
                }
                else {
                    for(ParamValue pvalue : param.getValues()) {
                        batchJobInput.addValue(paramId, pvalue.getValue());
                    }
                }
            } 
            List<JobInput> batchInputs=batchJobInput.prepareBatch();
            JobReceipt receipt=batchJobInput.submitBatch(batchInputs);
            return receipt;
        }
        catch (Throwable t) {
            log.error(t);
            throw new GpServerException("Error preparing job", t);
        }
    }
    
}
