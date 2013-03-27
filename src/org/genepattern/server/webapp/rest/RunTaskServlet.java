package org.genepattern.server.webapp.rest;

import org.genepattern.server.domain.Lsid;
import org.genepattern.server.job.input.ParamListHelper;
import org.genepattern.util.GPConstants;
import org.genepattern.util.LSID;
import org.genepattern.util.LSIDUtil;
import org.genepattern.server.webservice.server.local.LocalTaskIntegratorClient;
import org.genepattern.server.webservice.server.local.LocalAdminClient;
import org.genepattern.server.webapp.jsf.AuthorizationHelper;
import org.genepattern.server.dm.GpFilePath;
import org.genepattern.server.job.input.JobInput;
import org.genepattern.server.job.input.JobInputFileUtil;
import org.genepattern.server.rest.JobInputApiImpl;
import org.genepattern.server.config.ServerConfiguration;
import org.genepattern.webservice.*;
import org.genepattern.modules.ModuleJSON;
import org.genepattern.modules.ParametersJSON;
import org.genepattern.modules.ResponseJSON;
import org.genepattern.data.pipeline.PipelineDependencyHelper;
import org.apache.log4j.Logger;
import org.json.JSONObject;
import org.json.JSONArray;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServlet;
import java.util.*;
import java.io.*;

import javax.ws.rs.*;
import javax.ws.rs.core.*;

import com.sun.jersey.core.header.FormDataContentDisposition;
import com.sun.jersey.multipart.FormDataParam;

/**
 * Created by IntelliJ IDEA.
 * User: nazaire
 * Date: Jan 10, 2013
 * Time: 9:41:34 PM
 * To change this template use File | Settings | File Templates.
 */
@Path("/RunTask")
public class RunTaskServlet extends HttpServlet
{
    public static Logger log = Logger.getLogger(RunTaskServlet.class);
    /*public static final String UPLOAD = "/upload";
    public static final String RUN = "/run";
    */

    /**
	 * Inject details about the URI for this request
	 */
	@Context
    UriInfo uriInfo;

    @GET
    @Path("/load")
    @Produces(MediaType.APPLICATION_JSON)
    public Response loadModule(@QueryParam("lsid") String lsid, @QueryParam("reloadJob") String reloadJobId, @Context HttpServletRequest request)
    {
        try
        {
            String username = (String) request.getSession().getAttribute("userid");

            if (username == null)
            {
                throw new Exception("User not logged in");
            }

            ServerConfiguration.Context context = ServerConfiguration.Context.getContextForUser(username);
            JobInput jobInput = null;

            if (lsid == null && reloadJobId == null)
            {
                throw new Exception ("No lsid or job number to reload received");
            }

            if(reloadJobId != null && !reloadJobId.equals(""))
            {
                //This is a reloaded job
                jobInput= ParamListHelper.getInputValues(context, reloadJobId);

                String reloadedLsidString = jobInput.getLsid();

                //check if lsid is null
                if(lsid == null)
                {
                    lsid = reloadedLsidString;
                }
                else
                {
                    //warn the user if the reloaded job lsid and given lsid do not match
                    //but continue execution
                    Lsid reloadLsid = new Lsid(reloadedLsidString);
                    Lsid givenLsid = new Lsid(lsid);
                    if(reloadLsid.getLsidNoVersion().equals(givenLsid.getLsidNoVersion()))
                    {
                        log.warn("The given lsid " + givenLsid.getLsidNoVersion() + " does not match " +
                                "the lsid of the reloaded job " + reloadLsid.getLsidNoVersion());
                    }
                }

            }

            //check if lsid is still null
            if(lsid == null)
            {
                throw new Exception ("No lsid  received");
            }

            TaskInfo taskInfo = getTaskInfo(lsid, username);

            if(taskInfo == null)
            {
                throw new Exception("No task with task id: " + lsid + " found " +
                        "for user " + username);
            }

            ModuleJSON moduleObject = new ModuleJSON(taskInfo, null);
            moduleObject.put("lsidVersions", new JSONArray(getModuleVersions(taskInfo)));

            //check if user is allowed to edit the module
            boolean createModuleAllowed = AuthorizationHelper.createModule(username);
            boolean editable = createModuleAllowed && taskInfo.getUserId().equals(username)
                    && LSIDUtil.getInstance().isAuthorityMine(taskInfo.getLsid());
            moduleObject.put("editable", editable);

            //check if the user is allowed to view the module
            boolean isViewable = true;

            //check if the module has documentation
            boolean hasDoc = true;

            File[] docFiles = null;
            try {
                LocalTaskIntegratorClient taskIntegratorClient = new LocalTaskIntegratorClient(username);
                docFiles = taskIntegratorClient.getDocFiles(taskInfo);

                if(docFiles == null || docFiles.length == 0)
                {
                    hasDoc = false;
                }
            }
            catch (WebServiceException e) {
                log.error("Error getting doc files.", e);
            }
            moduleObject.put("hasDoc", hasDoc);

            //if this is a pipeline check if there are any missing dependencies
            TaskInfoAttributes tia = taskInfo.giveTaskInfoAttributes();
            String taskType = tia.get(GPConstants.TASK_TYPE);
            boolean isPipeline = "pipeline".equalsIgnoreCase(taskType);
            if(isPipeline && PipelineDependencyHelper.instance().getMissingDependenciesRecursive(taskInfo).size() != 0)
            {
                moduleObject.put("missing_tasks", true);
            }
            else
            {
                moduleObject.put("missing_tasks", false);                        
            }
            JSONObject responseObject = new JSONObject();
            responseObject.put(ModuleJSON.KEY, moduleObject);

            JSONArray parametersObject = getParameterList(taskInfo.getParameterInfoArray());
            responseObject.put(ParametersJSON.KEY, parametersObject);


            JSONObject initialValuesJSONObject = new JSONObject();

            //if this a reload job request then you also need to get the input values used for the job
            if(reloadJobId != null && !reloadJobId.equals(""))
            {
                Map<JobInput.ParamId, JobInput.Param> paramsMap = jobInput.getParams();

                ParameterInfo[] pInfoArray = taskInfo.getParameterInfoArray();
                for (ParameterInfo pInfo : pInfoArray)
                {
                    String pName = pInfo.getName();
                    List valuesList = new ArrayList();

                    //check if a value for this parameter was specified as a get request
                    if(request.getParameterMap().containsKey(pName))
                    {
                        String[] paramValues = request.getParameterValues(pName);
                        for(int i=0;i<paramValues.length;i++)
                        {
                            if(paramValues != null && !paramValues[i].equals(""))
                            {
                                valuesList.add(paramValues[i]);
                            }
                        }
                    }
                    else
                    {
                        JobInput.ParamId paramId = new JobInput.ParamId(pName);

                        //check that this parameter exists and that it does not have a null or an empty string value
                        if(paramsMap.containsKey(paramId) && jobInput.hasValue(pName))
                        {
                            JobInput.Param  param = paramsMap.get(paramId);
                            List<JobInput.ParamValue> paramValues = param.getValues();

                            Iterator<JobInput.ParamValue> paramValuesIterator = paramValues.listIterator();
                            while(paramValuesIterator.hasNext())
                            {
                                JobInput.ParamValue value = paramValuesIterator.next();

                                String stringValue = value.getValue();
                                //if value is set to null then assume it means an empty string
                                if(stringValue == null)
                                {
                                    log.error("Warning: A null value was found for the following parameter: " + pName
                                        + "\nThe null value will be replaced with an empty string.");
                                    stringValue = "";
                                }
                                valuesList.add(stringValue);
                            }
                        }
                    }

                    //check that this is a multi-file list parameter if more than one item was found
                    //in the list
                    if(valuesList.size() > 1)
                    {
                        HashMap<String, String> pInfoAttrMap = pInfo.getAttributes();
                        String maxValue = pInfoAttrMap.get("maxValue");
                        if(!pInfo.isInputFile())
                        {
                            continue;
                        }

                        try
                        {
                            int maxValueNum = Integer.parseInt(maxValue);
                            if(valuesList.size() > maxValueNum)
                            {
                                //this is an error: more input values were specified than
                                //this parameter allows so throw an exception
                                throw new Exception(" Error: " + valuesList.size() + " input values were specified for " +
                                pName + " but a maximum of " + maxValue + " is allowed. " + "Pleas");
                            }
                        }
                        catch(NumberFormatException ne)
                        {
                            // max value is not a number, so it must be unlimited
                            // do nothing and continue
                        }

                    }

                    //check if initial values were set for this parameter
                    if(valuesList.size() > 0)
                    {
                        initialValuesJSONObject.put(pName, valuesList);
                    }
                }
                responseObject.put("initialValues", initialValuesJSONObject);
            }

            return Response.ok().entity(responseObject.toString()).build();
        }
        catch(Exception e)
        {
            String message = "An error occurred while loading the module with lsid: \"" + lsid + "\"";
            if(e.getMessage() != null)
            {
                message = e.getMessage();
            }
            log.error(message);

            if(message.contains("You do not have the required permissions"))
            {
                throw new WebApplicationException(
                Response.status(Response.Status.FORBIDDEN)
                    .entity(message)
                    .build()
                );
            }
            else
            {
                throw new WebApplicationException(
                Response.status(Response.Status.BAD_REQUEST)
                    .entity(message)
                    .build()
                );
            }
        }
	}

    @POST
    @Path("/upload")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadFile(
        @FormDataParam("ifile") InputStream uploadedInputStream,
        @FormDataParam("ifile") FormDataContentDisposition fileDetail,
        @FormDataParam("paramName") final String paramName,
        @FormDataParam("index") final int index,        
        @Context HttpServletRequest request)
    {
        try
        {
            String username = (String) request.getSession().getAttribute("userid");
            if (username == null)
            {         
                throw new Exception("User not logged in");
            }

            ServerConfiguration.Context jobContext=ServerConfiguration.Context.getContextForUser(username);

            JobInputFileUtil fileUtil = new JobInputFileUtil(jobContext);
            GpFilePath gpFilePath=fileUtil.initUploadFileForInputParam(index, paramName, fileDetail.getFileName());

            // save it
            writeToFile(uploadedInputStream, gpFilePath.getServerFile().getCanonicalPath());
            fileUtil.updateUploadsDb(gpFilePath);

            String output = "File uploaded to : " + gpFilePath.getServerFile().getCanonicalPath();
            log.error(output);

            log.error(gpFilePath.getUrl().toExternalForm());
            ResponseJSON result = new ResponseJSON();
            result.addChild("location",  gpFilePath.getUrl().toExternalForm());
            return Response.ok().entity(result.toString()).build();
        }
        catch(Exception e)
        {
            String message = "An error occurred while uploading the file \"" + fileDetail.getFileName() + "\"";
            if(e.getMessage() != null)
            {
                message = message + ": " + e.getMessage();
            }
            log.error(message);

            throw new WebApplicationException(
                Response.status(Response.Status.BAD_REQUEST)
                    .entity(message)
                    .build()
            );
        }
    }

    @POST
    @Path("/addJob")
    @Produces(MediaType.APPLICATION_JSON)
    public Response addJob(
        JobSubmitInfo jobSubmitInfo,
        @Context HttpServletRequest request)
    {
        try
        {
            String username = (String) request.getSession().getAttribute("userid");
            if (username == null)
            {
                throw new Exception("User not logged in");
            }

            JobInput jobInput = new JobInput();
            jobInput.setLsid(jobSubmitInfo.getLsid());

            JSONObject parameters = new JSONObject(jobSubmitInfo.getParameters());
            Iterator<String> paramNames = parameters.keys();
            while(paramNames.hasNext())
            {
                String parameterName = paramNames.next();
                //JSONArray valueList = new JSONArray((String)parameters.get(parameterName));
                JSONArray valueList;
                Object val=parameters.get(parameterName);
                if (val instanceof JSONArray) {
                    valueList=(JSONArray) val;
                }
                else {
                    valueList = new JSONArray((String)parameters.get(parameterName));
                }
                for(int v=0; v<valueList.length();v++)
                {
                    jobInput.addValue(parameterName, valueList.getString(v));
                }
            }

            ServerConfiguration.Context jobContext=ServerConfiguration.Context.getContextForUser(username);

            JobInputApiImpl impl = new JobInputApiImpl();
            String jobId = impl.postJob(jobContext, jobInput);

            ResponseJSON result = new ResponseJSON();
            result.addChild("jobId", jobId);

            return Response.ok(result.toString()).build();

            //JSONObject result = new JSONObject(((String)jobSubmitInfo.getParameters());
            //String r2 = (String)result.get("input.file");
            //new JSONArray(r2);
        }
        catch(Exception e)
        {
            String message = "An error occurred while submitting the job";
            if(e.getMessage() != null)
            {
                message = message + ": " + e.getMessage();
            }
            log.error(message);

            throw new WebApplicationException(
                Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(message)
                    .build()
            );
        }
    }

    // save uploaded file to new location
    private void writeToFile(InputStream uploadedInputStream,
        String uploadedFileLocation) {

        try {
            OutputStream out = new FileOutputStream(new File(
                    uploadedFileLocation));
            int read = 0;
            byte[] bytes = new byte[1024];

            out = new FileOutputStream(new File(uploadedFileLocation));
            while ((read = uploadedInputStream.read(bytes)) != -1) {
                out.write(bytes, 0, read);
            }
            out.flush();
            out.close();
        } catch (IOException e) {

            e.printStackTrace();
        }

    }

    private JSONArray getParameterList(ParameterInfo[] pArray)
    {
        JSONArray parametersObject = new JSONArray();

        for(int i =0;i < pArray.length;i++)
        {
            ParametersJSON parameter = new ParametersJSON(pArray[i]);
            parametersObject.put(parameter);
        }

        return parametersObject;
    }

    private ArrayList getModuleVersions(TaskInfo taskInfo) throws Exception
    {
        LSID taskLSID = new LSID(taskInfo.getLsid());
        String taskNoLSIDVersion = taskLSID.toStringNoVersion();

        ArrayList moduleVersions = new ArrayList();
        TaskInfo[] tasks = TaskInfoCache.instance().getAllTasks();
        for(int i=0;i<tasks.length;i++)
        {
            TaskInfoAttributes tia = tasks[i].giveTaskInfoAttributes();
            String lsidString = tia.get(GPConstants.LSID);
            LSID lsid = new LSID(lsidString);
            String lsidNoVersion = lsid.toStringNoVersion();
            if(taskNoLSIDVersion.equals(lsidNoVersion))
            {
                moduleVersions.add(lsidString);
            }
        }

        return moduleVersions;
    }

    private TaskInfo getTaskInfo(String taskLSID, String username) throws WebServiceException
    {
        return new LocalAdminClient(username).getTask(taskLSID);
    }
}
