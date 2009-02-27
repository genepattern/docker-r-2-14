package org.genepattern.server.webapp;

import java.io.IOException;

import javax.servlet.Servlet;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.genepattern.server.auth.AuthenticationException;

/**
 * Servlet for logging an HTTP client into a GenePattern server; 
 * This is the recommended way to authenticate an HTTP client session from an application or script.
 * 
 * <pre>
 * Example HTTP requests:
 * 1. POST http://127.0.0.1:8080/gp/login?username=user&password=pw
 * 2. GET  http://127.0.0.1:8080/gp/login?username=user&password=pw
 * 3. POST http://127.0.0.1:8080/gp/login?username=user&password=pw&redirect=true
 * 4. GET  http://127.0.0.1:8080/gp/login?username=user&password=pw&redirect=false
 * 5. POST http://127.0.0.1:8080/gp/login?username=user&password=pw&redirect=true&origin=/gp/jobResults
 * 6. GET  http://127.0.0.1:8080/gp/login?username=user&password=pw&redirect=true&origin=/gp/jobResults
 * 
 * Request parameters
 *     username, required, The genepattern username.
 *     password, optional only of the server does not require passwords for authentication, The unencrypted password.
 *     redirect, optional, true | false, If true the server will include a redirect in the server response code.
 *     origin, optional, Sets the location when sending a redirect, otherwise the redirect is to home page.
 *     
 * Response codes
 * 1. 200 OK  
 *    Indicates successful login.
 *    
 * 2. 3xx
 *    Indicates successful login when redirect=true.
 *    
 * 3. 403
 *    Indicates login error either from invalid username, password, or some other server side error.
 *    Response headers, when a login error occurs, these response headers give more details:
 *        X-genepattern-AuthenticationException.Type
 *        X-genepattern-AuthenticationException.Message
 * </pre>
 * 
 * @see LoginManager#login(HttpServletRequest, HttpServletResponse, boolean)
 * @see org.genepattern.util.LoginHttpClient#loginLatest(org.apache.commons.httpclient.HttpClient)
 * 
 * @author pcarr
 */
public class LoginServlet extends HttpServlet implements Servlet {
    
    public void init(ServletConfig config) 
    throws ServletException
    {
        super.init(config);
    }
    
    public void doGet(HttpServletRequest req, HttpServletResponse resp) 
    throws IOException, ServletException
    {
        process(req, resp, true);
    }

    public void doPost(HttpServletRequest req, HttpServletResponse resp) 
    throws IOException, ServletException
    {
        process(req, resp, false);
    }
    
    private void process(HttpServletRequest request, HttpServletResponse resp, boolean redirect) 
    throws IOException
    {
        String redirectParam = request.getParameter("redirect");
        if (redirectParam != null) {
            redirect = Boolean.valueOf(redirectParam);
        }
        try {
            LoginManager.instance().login(request, resp, redirect);
        }
        catch (AuthenticationException e) {
            resp.setHeader("X-genepattern-AuthenticationException.Type", e.getType().toString());
            resp.setHeader("X-genepattern-AuthenticationException.Message", e.getMessage());
            resp.sendError(HttpServletResponse.SC_FORBIDDEN, e.getLocalizedMessage());
        }
    }
}
