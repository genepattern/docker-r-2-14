/*******************************************************************************
 * Copyright (c) 2003, 2015 Broad Institute, Inc. and Massachusetts Institute of Technology.  All rights reserved.
 *******************************************************************************/
package org.genepattern.server.rest;

import org.apache.log4j.Logger;
import org.genepattern.server.config.GpConfig;
import org.genepattern.server.config.GpContext;
import org.genepattern.server.config.ServerConfigurationFactory;

/**
 * Factory method for initializing an instance of the JobInputApi.
 * 
 * @author pcarr
 */
public class JobInputApiFactory {
    private static final Logger log = Logger.getLogger(JobInputApiFactory.class);
    static public JobInputApi createJobInputApi(GpConfig gpConfig, GpContext context) {
        final boolean initDefault=false;
        return createJobInputApi(gpConfig, context, initDefault);
    }

    /** @deprecated, should pass in a valid GpConfig */
    static public JobInputApi createJobInputApi(GpContext context, boolean initDefault) {
        GpConfig gpConfig=ServerConfigurationFactory.instance();
        return createJobInputApi(gpConfig, context, initDefault);
    }
    static public JobInputApi createJobInputApi(GpConfig gpConfig, GpContext context, boolean initDefault) {
        if (gpConfig==null) {
            gpConfig=ServerConfigurationFactory.instance();
        }
        final String jobInputApiClass=gpConfig.getGPProperty(context, "jobInputApiClass", JobInputApiImplV2.class.getName());
        if (JobInputApiImplV2.class.getName().equals(jobInputApiClass)) {
            return new JobInputApiImplV2(initDefault);
        }
        else if (JobInputApiImpl.class.getName().equals(jobInputApiClass)) {
            return new JobInputApiImpl(gpConfig, initDefault);
        }
        if (jobInputApiClass != null) {
            log.error("Ignoring config property jobInputApiClass="+jobInputApiClass);
        }
        return new JobInputApiImpl(gpConfig, initDefault);
    }
}
