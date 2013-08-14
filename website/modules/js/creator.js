/*
 The Broad Institute
 SOFTWARE COPYRIGHT NOTICE AGREEMENT
 This software and its documentation are copyright (2003-2012) by the
 Broad Institute. All rights are reserved.

 This software is supplied without any warranty or guaranteed support
 whatsoever. The Broad Institute cannot be responsible for its
 use, misuse, or functionality.
 */

var mainLayout;
var run = false;
var dirty = false;
var saving = false;

var module_editor = {
    lsid: "",
    uploadedfiles: [],
    filestoupload: [],
    filesToDelete: [],
    currentUploadedFiles: [],
    licensefile: "",
    otherModAttrs: {}
};

var Request = {
    parameter: function(name) {
        return this.parameters()[name];
    },

    parameters: function() {
        var result = {};
        var url = window.location.href;
        var parameters = url.slice(url.indexOf('?') + 1).split('&');

        for(var i = 0;  i < parameters.length; i++) {
            var parameter = parameters[i].split('=');
            result[parameter[0]] = parameter[1];
        }
        return result;
    }
};

//For those browsers that dont have it so at least they won't crash.
if (!window.console)
{
    window.console = { time:function(){}, timeEnd:function(){}, group:function(){}, groupEnd:function(){}, log:function(){} };
}

function trim(s)
{
    var l=0; var r=s.length -1;
    while(l < s.length && s[l] == ' ')
    {	l++; }
    while(r > l && s[r] == ' ')
    {	r-=1;	}
    return s.substring(l, r+1);
}

function setDirty(value)
{
    dirty = value;

    //if page is not already marked as dirty
    if(dirty)
    {
        $(window).bind('beforeunload', function()
        {
            return 'If you leave this page all module changes will be lost.';
        });
    }
    else
    {
        $(window).unbind('beforeunload');
    }
}

function isDirty()
{
    return dirty;
}

function bytesToSize(bytes)
{
    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;

    if ((bytes >= 0) && (bytes < kilobyte)) {
        return bytes + ' B';

    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed() + ' KB';

    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed() + ' MB';

    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed() + ' GB';

    } else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed() + ' TB';

    } else {
        return bytes + ' B';
    }
}


function saveError(errorMessage)
{
    $("#savingDialog").empty();
    $("#savingDialog").append(errorMessage).dialog({
        resizable: true,
        width: 400,
        height:200,
        modal: true,
        title: "Module Save Error",
        buttons: {
            OK: function() {
                $(this).dialog("destroy");
                throw(errorMessage);
            }
        }
    });
    saving = false;
}

function updateModuleVersions(lsids)
{
    if(lsids == undefined || lsids == null)
    {
        return;
    }

    var currentVersion = $('select[name="modversion"]').val();
    $('select[name="modversion"]').children().remove();
    var modVersionLsidList = lsids;
    for(v =0;v<modVersionLsidList.length;v++)
    {
        var versionnum = modVersionLsidList[v];
        var index = versionnum.lastIndexOf(":");
        if(index == -1)
        {
            alert("An error occurred while loading module versions.\nInvalid lsid: " + moduleVersionLsidList[v]);
        }
        var version = versionnum.substring(index+1, versionnum.length);
        var modversion = "<option value='" + versionnum + "'>" + version + "</option>";
        $('select[name="modversion"]').append(modversion);
        $('select[name="modversion"]').multiselect("refresh");
    }

    $('select[name="modversion"]').change(function()
    {
        var editLocation = "creator.jsf?lsid=" + $(this).val();
        window.open(editLocation, '_self');
    });

    $('select[name="modversion"]').val(currentVersion);
    $('select[name="modversion"]').multiselect("refresh");
}

function runModule(lsid)
{
    window.open("/gp/pages/index.jsf?lsid=" + lsid, '_self');
}

function saveModule()
{
    var modname = $('#modtitle').val();
    if(modname == undefined || modname == null || modname.length < 1)
    {
        saveError("A module name must be specified");
        return;
    }

    var description = $('textarea[name="description"]').val();
    var author = $('input[name="author"]').val();
    var organization = $('input[name="organization"]').val();

    if(organization !== undefined && organization !== "")
    {
        author = author + ";" + organization;
    }

    var privacy = $('select[name="privacy"] option:selected').val();
    var quality = $('select[name="quality"] option:selected').val();
    var language = $('select[name="language"] option:selected').val();
    var lang_version = $('input[name="lang_version"]').val();
    var os = $('input[name=os]:checked').val();
    var tasktype = $("select[name='category'] option:selected").val();
    var cpu = $("select[name='cpu'] option:selected").val();
    var commandLine = $('textarea[name="cmdtext"]').val();
    var fileFormats = $('select[name="mod_fileformat"]').val();

    if(fileFormats == null)
    {
        fileFormats = [];
    }

    if(commandLine == undefined || commandLine == null || commandLine.length < 1)
    {
        saveError("A command line must be specified");
        return("A command line must be specified");
    }

    var licenseFile = module_editor.licensefile;
    if(licenseFile == null || licenseFile == undefined)
    {
        licenseFile = "";
    }

    var lsid = module_editor.lsid;
    var supportFiles = module_editor.uploadedfiles;
    var version = $('input[name="comment"]').val();
    var filesToDelete = module_editor.filesToDelete;

    var json = {};
    json["module"] = {"name": modname, "description": description,
        "author": author, "privacy": privacy, "quality": quality,
        "language": language, "JVMLevel": lang_version, "cpuType": cpu, "taskType": tasktype, "version": version,
        "os": os, "commandLine": commandLine, "LSID": lsid, "supportFiles": supportFiles,
        "filesToDelete": filesToDelete, "fileFormat": fileFormats, "license":licenseFile};

    //add other remaining attributes
    $.each(module_editor.otherModAttrs, function(keyName, value) {
        console.log("\nsaving other module attributes: " + keyName + "=" + module_editor.otherModAttrs[keyName]);
        json.module[keyName] = module_editor.otherModAttrs[keyName];
    });

    json["parameters"] = getParametersJSON();

    $.ajax({
        type: "POST",
        url: "/gp/ModuleCreator/save",
        data: { "bundle" : JSON.stringify(json) },
        success: function(response) {
            $("#savingDialog").dialog("destroy");

            saving = false;

            var error = response["ERROR"];
            var newLsid = response["lsid"];
            //get updated module versions
            var versions = response["lsidVersions"];

            if (error !== undefined && error !== null) {
                saveError(error);
                return;
            }

            setDirty(false);
            updateModuleVersions(versions);

            // Update the LSID upon successful save
            if (newLsid !== undefined && newLsid !== null)
            {
                $("#lsid").empty().append("LSID: " + newLsid);
                var vindex = newLsid.lastIndexOf(":");
                if(vindex != -1)
                {
                    var version = newLsid.substring(vindex+1, newLsid.length);
                    var modtitle = $("#modtitle").val();

                    $("#savedDialog").append(modtitle + " version " + version + " saved");
                    $("#savedDialog").dialog({
                        resizable: false,
                        width: 400,
                        height:130,
                        modal: true,
                        title: "Module Saved",
                        buttons: {
                            OK: function() {
                                $( this ).dialog( "close" );
                                module_editor.lsid = newLsid;
                                module_editor.uploadedfiles = [];

                                var unversioned = $(' select[name="modversion"] option[value="unversioned"]');
                                if(unversioned != undefined && unversioned != null)
                                {
                                    unversioned.remove();
                                }

                                $('select[name="modversion"]').val(newLsid);
                                if($('select[name="modversion"]').val() != newLsid)
                                {
                                    var modversion = "<option value='" + newLsid + "'>" + version + "</option>";
                                    $('select[name="modversion"]').append(modversion);
                                    $('select[name="modversion"]').val(version);
                                }

                                $('select[name="modversion"]').multiselect("refresh");

                                if(run)
                                {
                                    runModule(newLsid);
                                }
                                else
                                {
                                    //reload the editor page using the new LSID
                                    var editLocation = "creator.jsf?lsid=" + newLsid;
                                    window.open(editLocation, '_self');
                                }
                            }
                        }
                    });
                }
            }
        },
        dataType: "json"
    });

    module_editor.filesToDelete = [];
}

function editModule()
{
    var lsid = Request.parameter('lsid');

    if(lsid !== undefined && lsid !== null && lsid.length > 0)
    {
        lsid = lsid.replace(/#/g, "");
        loadModule(lsid);
    }
}

function addparameter()
{
    var paramDiv = $("<div class='parameter'>  \
        <table class='deloptions'>\
        <tr> <td class='dragIndicator'></td>\
        <td class='btntd'>\
        <button class='delparam'>x Delete</button></td><td>\
        <p>Name*: <br/>\
        <input type='text' name='p_name' size='28'/>\
        </p><p>\
        <input type='checkbox' name='p_optional' size='25'/>Make this parameter optional.</p>\
        <p>Description:<br/>\
        <textarea cols='60' name='p_description' rows='2'></textarea></p>\
        </td><td >\
        <table class='pmoptions'>\
        <tr><td>Flag:<br/><input type='text' name='p_flag' size='7'/>\
        <input type='checkbox' name='p_prefix' size='7' disabled='disabled'/> prefix when specified \
        </td> \
        </tr>\
        <tr><td>Type of field to display*:<br/>\
                <select name='p_type' class='m_select'>\
                        <option value='text'>Text Field</option> \
                        <option value='Input File'>Input File Field</option>\
                </select>\
        </td></tr></table>\
        </td></tr>\
        </table>\
        <div class='editChoicesDialog'/> \
    </div>");

    //trigger change so that the options for the Text type are displayed
    changeParameterType(paramDiv.find("select[name='p_type']"));

    paramDiv.find("select[name='p_type']").multiselect({
        multiple: false,
        header: false,
        noneSelectedText: "Select type",
        selectedList: 1,
        position: {
            my: 'left bottom',
            at: 'left top'
        }
    });

    $('#parameters').append(paramDiv);

    paramDiv.find(".delparam").button().click(function()
    {
        //first remove the parameter from the commandline
        var pelement = $(this).parent().parent().find("input[name='p_name']");

        if(!confirm("Are you sure you want to delete this parameter?"))
        {
            return;
        }

        var felement = $(this).parent().parent().find("input[name='p_flag']");
        pelement.val("");
        felement.val("");

        updateparameter($(this).parent().parent());

        $(this).parents("div:first").remove();

        setDirty(true);
    });

    $("select[name='p_type']").live("change", function()
    {
        var tSelect = $(this);
        changeParameterType(tSelect);
    });

    return paramDiv;
}

function addtocommandline(flag, name, prevflag, prevname)
{
    var text = "";

    if (flag == "" && name == "" && prevflag ==undefined && prevname == undefined)
    {
        return;
    }

    //construct new parameter value
    if(name !== "")
    {
        text = "&lt;" + name + "&gt;";
    }

    if(flag !== "")
    {
        text = flag + text;
    }

    var item = $("<li class='commanditem'>" + text + "</li>");

    //construct prev parameter value
    var  prevtext = "";
    if(prevname !== "")
    {
        prevtext = "&lt;" + prevname + "&gt;";
    }

    if(prevflag !== "")
    {
        prevtext = prevflag + prevtext;
    }

    //if no change in value do nothing
    if(prevtext == text)
    {
        return;
    }

    //look for child with matching old parameter value and replace with new parameter value
    var found = false;

    var cmdline= $("#commandtextarea textarea").val();
    var decodedPrevText = $('<div/>').html(prevtext).text();

    var decodedText = $('<div/>').html(text).text();

    $('#commandlist').children().each(function()
    {
        //decode the prevtext string first and compare it
        if($(this).text() ==  decodedPrevText)
        {
            if(text !== "")
            {
                $(this).replaceWith(item);
            }
            else
            {
                $(this).remove();
            }
            found = true;
            cmdline = cmdline.replace(decodedPrevText, decodedText);
            $("#commandtextarea textarea").val(cmdline);

        }
    });

    // if old parameter value was not found then this must be a new parameter so
    // insert it into parameter list
    if(text !== "")
    {
        $('#commandlist').append(item);

        //if argument is already in command which will occur if this is
        // a module edit
        if(cmdline.indexOf(decodedText) == -1)
        {
            cmdline += " " + decodedText;
            $("#commandtextarea textarea").val(cmdline);
        }
    }
}

//update the specific parameter div
function updateparameter(parameter, updateCmdLine)
{
    if(typeof(updateCmdLine)==='undefined') updateCmdLine = true;
    var pelement = parameter.find("input[name='p_name']");
    var felement = parameter.find("input[name='p_flag']");

    var pelementval = pelement.val().replace(/ /g, ".");
    pelement.val(pelementval);

    var pname_newval = pelement.val();
    var pflag_newval = felement.val();
    if(parameter.find("input[name='p_prefix']").attr('checked'))
    {
        pflag_newval = "";
    }

    var pname_oldval = pelement.data('oldVal');
    var pflag_oldval = felement.data('oldVal');

    pelement.data('oldVal',  pname_newval );
    felement.data('oldVal',  pflag_newval );

    var paramExists = true;
    //check if parameter exists
    $("input[name='p_name']").each(function()
    {
        if($(this).val() == pname_newval)
        {
            paramExists = !paramExists;
        }
    });

    if(paramExists)
    {
        alert("The parameter: " + pname_newval + " already exists.");
        pelement.val("");
        return;
    }

    //do not update the command line
    if(updateCmdLine)
    {
        addtocommandline(pflag_newval, pname_newval, pflag_oldval, pname_oldval);
    }
    else
    {
        //add any new parameter to the command line argument listing
        if(pname_oldval == undefined && pflag_oldval == undefined)
        {
            var text = "&lt;" + pname_newval + "&gt;";
            text = pflag_newval + text;

            var decodedText = $('<div/>').html(text).text();
            var cmdline= $("#commandtextarea textarea").val();


            if(cmdline.indexOf(decodedText) != -1)
            {
                var item = $("<li class='commanditem'>" + text + "</li>");

                $('#commandlist').append(item);
            }
        }
    }
}

function changeParameterType(element)
{
    if(!element.parent().next().children().is("input[name='p_prefix']"))
    {
        element.parent().next().remove();
    }

    var value = element.val();
    element.parents(".pmoptions").parent().find(".textFieldData").remove();

    var fieldDetailsTd = $("<td/>");
    if(value == "Input File")
    {
        fieldDetailsTd.append("File format: <br/>");

        var fileFormatList = $('<select multiple="multiple" name="fileformat"></select>');
        var fileFormatButton = $('<button id="addinputfileformat">New</button>');

        fileFormatButton.button().click(function()
        {
            $( "#addfileformatdialog" ).dialog("open");
        });

        //copy option values from the modules output file format list that was generated earlier
        $('select[name="mod_fileformat"]').children("option").each(function()
        {
            fileFormatList.append("<option>" + $(this).val() + "</option>");
        });

        fieldDetailsTd.append(fileFormatList);
        fieldDetailsTd.append(fileFormatButton);

        fileFormatList.multiselect({
            header: false,
            noneSelectedText: "Specify input file formats",
            selectedList: 4, // 0-based index
            position:
            {
                my: 'left bottom',
                at: 'left top'
            }
        });
    }
    else
    {
        var dataTypeTd = $("<td class='textFieldData'/>");
        dataTypeTd.append("Type of data to enter*: <br/>");
        var formatList = $("<select name='p_format'>\
                <option value='String'>Text</option>\
                <option value='Integer'>Integer</option>\
                <option value='Floating Point'>Floating Point</option>\
                <option value='Directory'>Directory</option>\
                <option value='Password'>Password</option>\
            </select> ");
        formatList.change(function()
        {
            //hide choices info if this is a directory or password entry
            if($(this).val() == "Directory" || $(this).val() == "Password")
            {
                $(this).parents(".parameter:first").find(".choices").hide();
            }
            else
            {
                $(this).parents(".parameter:first").find(".choices").show();
            }
        });

        dataTypeTd.append(formatList);
        formatList.multiselect({
            header: false,
            multiple: false,
            noneSelectedText: "Specify text format",
            selectedList: 1, // 0-based index
            position:
            {
                my: 'left bottom',
                at: 'left top'
            }
        });

        $("<tr/>").append(dataTypeTd).appendTo(element.parents(".pmoptions"));
    }

    var typeDetailsTable = $("<table class='ptypeDetails pmoptions'/>");

    element.parents(".pmoptions").parent().next(".lasttd").remove();

    $("<td class='lasttd'/>").append(typeDetailsTable).insertAfter(element.parents(".pmoptions").parent());
    $("<tr/>").append(fieldDetailsTd).appendTo(typeDetailsTable);

    var defaultValueRow = $("<tr/>");
    var defaultValue = $("<input type='text' name='p_defaultvalue' class='defaultValue'/>");
    $("<td/>").append("Default value:<br/>").append(defaultValue).appendTo(defaultValueRow);
    typeDetailsTable.append(defaultValueRow);

    var specifyChoicesRow = $("<tr class='choices'/>");
    var editChoicesLink = $("<a href='#' class='choicelink'>add a drop-down list</a>");
    editChoicesLink.click(function(event)
    {
        event.preventDefault();

        var isFile = !($(this).parents(".parameter").find("select[name='p_type']").val() != "Input File");
        var choices = $(this).parents(".parameter").find("input[name='choicelist']").val();
        var pName = $(this).parents(".parameter").find("input[name='p_name']").val();
        var title =  "Create drop-down list";
        if(pName != null && pName != undefined && pName.length > 0)
        {
            pName =  pName.replace(/\./g, " ");

            title = "Edit Choices for "+ pName;
        }

        var editChoicesDialog = $(this).parents(".parameter").find(".editChoicesDialog");
        editChoicesDialog.empty();

        editChoicesDialog.dialog({
            autoOpen: true,
            height: 620,
            width: 600,
            title: title,
            create: function()
            {
                var enterValuesDiv = $("<div class='hcontent'/>");
                $(this).prepend(enterValuesDiv);

                var staticChoiceDiv = $("<div class='staticChoicesDiv'/>");
                enterValuesDiv.append(staticChoiceDiv);
                var choiceButton = $("<button class='choiceadd'>Add Menu Item</button>");
                choiceButton.button().click(function()
                {
                    var choicerow = $("<tr> <td class='defaultChoiceCol'> <input type='radio' name='cradio' disabled='disabled'/></td>" +
                        "<td> <input type='text' name='choicev'/> </td>" +
                        "<td> <input type='text' name='choicen'/> </td>" +
                        "<td> <button> X </button></td></tr>");
                    choicerow.find("button").button().click(function()
                    {
                        $(this).parent().parent().remove();
                    });

                    choicerow.find("input[name='choicev']").focusout(function()
                    {
                        //set the display value if it is empty
                        if($(this).val() != "")
                        {
                            if(choicerow.find("input[name='choicen']").val() == "")
                            {
                                var displayVal = $(this).val();
                                if(isFile)
                                {
                                    displayVal = displayVal.replace(/\/\//g, '');
                                    var url_split = displayVal.split("/");
                                    if(url_split.length > 1)
                                    {
                                        //get last item in parsed file url
                                        displayVal = url_split[url_split.length -1];
                                    }
                                }

                                choicerow.find("input[name='choicen']").val(displayVal);
                            }
                            choicerow.find("input[name='cradio']").removeAttr("disabled");
                        }
                        else
                        {
                            choicerow.find("input[name='cradio']").attr("disabled", "disabled");
                        }
                    });

                    $(this).parent().find("table").append(choicerow);
                });
                staticChoiceDiv.append(choiceButton);

                var valueColHeader = "Value";
                var dValueColHeader = "Display Value";
                var valueColHeaderDescription = "The value to pass on the command line";
                var dValueColHeaderDescription = "The value to display in the drop-down list";

                if(isFile)
                {
                    //change header text for file choices
                    valueColHeader = "URL";
                    valueColHeaderDescription = "Enter URLs (ftp, http, https)";
                }

                var table = $("<table class='staticChoiceTable'>" +
                    "<tr><td> <span class='staticTableHeader'> Default </span> " +
                    "<input type='radio' name='cradio' checked='checked'/> </td>" +
                    "<td> <span class='staticTableHeader'>" + valueColHeader + "</span>" +
                    "<br/>" +
                    "<span class='shortDescription'>" + valueColHeaderDescription + "</span>" +
                    "</td> <td>"+
                    "<span class='staticTableHeader'>" + dValueColHeader + "</span>" +
                    "<br/>" +
                    "<span class='shortDescription'>" + dValueColHeaderDescription + "</span>" +
                " </td> </tr> </table>");

                table.find("input[name='cradio']").data("nullRow", true);

                staticChoiceDiv.prepend(table);

                table.find("tbody").sortable();

                var result = choices.split(';');
                if(choices== "" || result == null  || result.length < 1)
                {
                    //start with two rows of data
                    choiceButton.click();
                    choiceButton.click();
                }
                else
                {
                    for(var i=0;i<result.length;i++)
                    {
                        var rowdata = result[i].split("=");

                        var displayValue = "";
                        var value = "";
                        if(rowdata.length > 1)
                        {
                            displayValue = rowdata[1];
                            value = rowdata[0];
                        }
                        else
                        {
                            value = rowdata[0];
                        }

                        choiceButton.click();

                        table.find("input[name='cradio']").last().removeAttr("disabled");

                        //check if this should be set as the default
                        if(element.parents(".parameter").find(".defaultValue").val() == value)
                        {
                            table.find("input[name='cradio']").last().attr("checked", "checked");
                        }

                        table.find("input[name='choicev']").last().val(value);
                        table.find("input[name='choicen']").last().val(displayValue);
                    }
                }

                if(isFile)
                {
                    //type is file then display field to input url to retrieve
                    //files from
                    var choiceURLDiv = $("<div class='choicesURLDiv'/>");

                    var choiceURLTable = $("<table/>");
                    choiceURLDiv.append(choiceURLTable);
                    var choiceURLTableTR = $("<tr/>");
                    choiceURLTableTR.append("<td>Ftp directory:</td>");
                    var choiceURL = $("<input name='choiceURL' type='text' size='45'/>");
                    choiceURL.val(element.parents(".parameter").find("input[name='choiceDir']").val());
                    $("<td/>").append(choiceURL).append("<div class='shortDescription'>Enter the ftp directory " +
                        "containing the files to use to populate the drop-down list</div>").appendTo(choiceURLTableTR);
                    choiceURLTable.append(choiceURLTableTR);

                    //add filter box
                    var choiceURLTableFilterTR = $("<tr/>");
                    choiceURLTableFilterTR.append("<td>File filter:</td>");
                    choiceURLTable.append(choiceURLTableFilterTR);
                    var fileFilter = $("<input name='choiceURLFilter' type='text'/>");
                    fileFilter.val(element.parents(".parameter").find("input[name='choiceDirFilter']").val());
                    $("<td/>").append(fileFilter).append("<div class='shortDescription'>Enter a glob expression pattern (i.e *.gct) " +
                         "for filtering the files found on the ftp directory</div>").appendTo(choiceURLTableFilterTR);

                    var altStaticChoiceToggle = $("<input type='checkbox' class='staticChoiceLink'/>");
                    altStaticChoiceToggle.click(function(event)
                    {
                        $(this).parents(".editChoicesDialog").find(".staticChoicesDiv").toggle();
                    });
                    $("<span>Specify alternative static drop-down list</span>").prepend(altStaticChoiceToggle).appendTo(choiceURLDiv);

                    var altStaticChoiceDescription = $("<span class='altStaticDesc shortDescription'> Static values will be " +
                        "displayed in the event the dynamic choices cannot be loaded</span>");
                    altStaticChoiceToggle.parent().append("<br/>").append(altStaticChoiceDescription);

                    enterValuesDiv.prepend(choiceURLDiv);

                    $(this).prepend("<p class='heading editChoicesHeading'>Step 2: Enter URL(s)</p>");


                    var dynamicChoiceButton = $('<input type="radio" name="radio"/><label for="radio1">Dynamic drop-down list</label>');
                    dynamicChoiceButton.click(function()
                    {
                        $(this).parents(".editChoicesDialog").find(".choicesURLDiv").show();
                        $(this).parents(".editChoicesDialog").find(".staticChoiceLink").removeAttr("checked");
                        $(this).parents(".editChoicesDialog").find(".staticChoicesDiv").hide();
                    });

                    var staticChoiceButton = $('<input type="radio" name="radio"/><label for="radio1">Static drop-down list</label>');
                    staticChoiceButton.click(function()
                    {
                        $(this).parents(".editChoicesDialog").find(".choicesURLDiv").hide();
                        $(this).parents(".editChoicesDialog").find(".staticChoicesDiv").show();
                    });

                    var selectChoiceTypeDiv = $("<div class='selectChoiceTypeDiv hcontent'/>");
                    $("<div/>").append("<p class='editChoiceEntry'>Select this option to manually enter a list of files to populate the drop-down list</p>").prepend(staticChoiceButton).appendTo(selectChoiceTypeDiv);
                    $("<div/>").append("<p class='editChoiceEntry'>Select this option to create a drop-down list that will be dynamically populated <br/> with a list of files found at a remote location</p>").prepend(dynamicChoiceButton).appendTo(selectChoiceTypeDiv);
                    $(this).prepend(selectChoiceTypeDiv);

                    var selectDropDownType = $("<p class='heading editChoicesHeading'>Step 1: Select drop-down type</p>");
                    $(this).prepend(selectDropDownType);

                    addsectioncollapseimages();

                    if(choiceURL.val() != undefined && choiceURL.val() != null && choiceURL.val() != "")
                    {
                        dynamicChoiceButton.click();
                    }
                    else
                    {
                        staticChoiceButton.click();
                    }
                }
            },
            close: function()
            {
                $( this ).dialog( "destroy" );
            },
            buttons: {
                "OK": function() {
                    var choicelist = "";
                    element.parents(".parameter").find(".defaultValue").val("");
                    var newDefault = "";
                    $(this).find(".staticChoiceTable").find("tr").each(function()
                    {
                        var dvalue = $(this).find("td input[name='choicen']").val();
                        var value = $(this).find("td input[name='choicev']").val();

                        if((dvalue == undefined && value == undefined)
                            || (dvalue == "" && value==""))
                        {
                            return;
                        }

                        if(choicelist !== "")
                        {
                            choicelist += ";";
                        }

                        if(dvalue == undefined || dvalue == null|| dvalue == "")
                        {
                            choicelist += value;
                        }
                        else
                        {
                            choicelist += value + "=" + dvalue;
                        }

                        //set default value
                        if($(this).find("input[name='cradio']").is(":checked"))
                        {
                            //set the default value
                            newDefault = $(this).find("input[name='choicev']").val();
                            newDefault = newDefault.trim();
                        }
                    });

                    //validate if default value is valid
                    var defaultValueObj = element.parents(".parameters").find(".defaultValue");
                    validateDefaultChoiceValue(defaultValueObj);
                    element.parents(".parameter").find("input[name='choicelist']").val(choicelist);
                    element.parents(".parameter").find("input[name='choicelist']").trigger("change");

                    //set default value
                    if(choicelist.length > 0)
                    {
                        element.parents(".parameter").find(".defaultValue").combobox("destroy");
                        element.parents(".parameter").find(".defaultValue").find("option:selected").removeAttr("selected");
                        element.parents(".parameter").find(".defaultValue").val(newDefault);

                        if(element.parents(".parameter").find(".defaultValue").val() != newDefault)
                        {
                            element.parents(".parameter").find(".defaultValue").append("<option value='" + newDefault + "'>" +
                                newDefault + "</option>");
                            element.parents(".parameter").find(".defaultValue").val(newDefault);
                        }
                        element.parents(".parameter").find(".defaultValue").combobox();
                    }

                    //set the dynamic url if there is any
                    var choiceURL = $(this).find("input[name='choiceURL']").val();
                    if(choiceURL != undefined && choiceURL != null && choiceURL.length > 0)
                    {
                       element.parents(".parameter").find("input[name='choiceDir']").val(choiceURL);
                       element.parents(".parameter").find("input[name='choiceDir']").trigger("change");
                    }

                    //set the dynamic url filter if there is any
                    var choiceURLFilter = $(this).find("input[name='choiceURLFilter']").val();
                    if(choiceURLFilter != undefined && choiceURLFilter != null && choiceURLFilter.length > 0)
                    {
                        element.parents(".parameter").find("input[name='choiceDirFilter']").val(choiceURLFilter);
                        element.parents(".parameter").find("input[name='choiceDirFilter']").trigger("change");
                    }

                    $(this).dialog( "destroy" );
                },
                "Cancel": function()
                {
                    $(this).dialog( "destroy" );
                }
            },
            resizable: true
        });
    });

    $("<td/>").append(editChoicesLink).appendTo(specifyChoicesRow);

    editChoicesLink.parent().append("<a href='createhelp.jsp#paramType' target='help'> " +
        " <img src='styles/images/help_small.gif' width='12' height='12' alt='help' class='buttonIcon' />"
        + "</a>");

    editChoicesLink.parent().append("<div class='staticChoicesInfo'/>");
    editChoicesLink.parent().append("<div class='dynamicChoicesInfo'/>");

    //create hidden link for list of choices
    editChoicesLink.parent().append("<input type='hidden' name='choicelist'/>");

    //also create hidden fields for the ftp directory and file filter
    editChoicesLink.parent().append("<input type='hidden' name='choiceDir'/>");
    editChoicesLink.parent().append("<input type='hidden' name='choiceDirFilter'/>");

    editChoicesLink.parent().find("input[name='choicelist']").change(function()
    {
        var choicelist = $(this).parents(".parameter").find("input[name='choicelist']").val();
        $(this).parents(".parameter").find(".staticChoicesInfo").text("");

        if(choicelist != null && choicelist != undefined && choicelist.length > 0)
        {
            //change text of the create drop down link to edit
            $(this).parents(".parameter").find(".choicelink").text("edit drop down list");

            var choicelistArray = choicelist.split(";");
            if(choicelistArray.length > 0)
            {
                $(this).parents(".parameter").find(".staticChoicesInfo").append("Static list: " + choicelistArray.length + " items");
            }

            //change the default value field to a combo box
            var currentDefaultValue = $(this).parents(".parameter").find(".defaultValue").val();

            var defaultValueComboBox = $("<select class='defaultValue'/>");
            for(var t=0;t<choicelistArray.length;t++)
            {
                var result = choicelistArray[t].split("=");
                defaultValueComboBox.append("<option value='" + result[0]+ "'>" + result[0]+ "</option>");

                if(result[0] == currentDefaultValue)
                {
                    defaultValueComboBox.val(result[0]);
                }
            }

            if(defaultValueComboBox.val() != currentDefaultValue)
            {
                defaultValueComboBox.append("<option value='" + currentDefaultValue + "'>"
                    + currentDefaultValue + "</option>");
                defaultValueComboBox.val(currentDefaultValue);
            }

            var prevDef = $(this).parents(".parameter").find(".defaultValue");
            $(this).parents(".parameter").find(".defaultValue").after(defaultValueComboBox);
            prevDef.remove();
            $(this).parents(".parameter").find(".defaultValue").combobox();
        }
        else
        {
            $(this).parents(".parameter").find(".choicelink").text("add a drop down list");
            $(this).parents(".parameter").find(".defaultValue").replaceWith("<input name='p_defaultvalue' class='defaultValue'/>");
        }
    });

    specifyChoicesRow.find("input[name='choiceDir']").change(function()
    {
        $(this).parents(".parameter").find(".dynamicChoicesInfo").text("");

        var ftpDir = $(this).parents(".parameter").find("input[name='choiceDir']").val();
        if(ftpDir != null && ftpDir != undefined && ftpDir.length > 0)
        {
            //change text of the create drop down link to edit
            $(this).parents(".parameter").find(".choicelink").text("edit drop down list");

            $(this).parents(".parameter").find(".dynamicChoicesInfo").append("Dynamic directory URL: "
                + ftpDir.substring(0, 50));
        }
        else
        {
            $(this).parents(".parameter").find(".choicelink").text("add a drop down list");
        }

    });

    typeDetailsTable.append(specifyChoicesRow);
}

function updatemodulecategories()
{
    $.ajax({
        type: "POST",
        url: "/gp/ModuleCreator/categories",
        success: function(response) {
            var error = response["ERROR"];
            if (error !== undefined) {
                alert(error);
            }
            else {
                var categories = response["categories"];
                categories = categories.substring(1, categories.length-1);

                var result = categories.split(", ");
                var mcat = $("select[name='category']");

                for(i=0;i < result.length;i++)
                {
                    mcat.append($("<option>" + result[i] + "</option>"));
                }
                mcat.multiselect("refresh");
            }
        },
        dataType: "json"
    });
}

function updatefileformats()
{
    $.ajax({
        type: "POST",
        url: "/gp/ModuleCreator/fileformats",
        success: function(response) {
            var error = response["ERROR"];
            if (error !== undefined) {
                alert(error);
            }
            else {
                var fileformats = response["fileformats"];

                var unique_fileformatlist = [];

                for(m=0;m < fileformats.length;m++)
                {
                    var index = unique_fileformatlist.indexOf(fileformats[m]);

                    if(index == -1)
                    {
                        unique_fileformatlist.push(fileformats[m]);
                    }
                }

                var result = unique_fileformatlist;

                var mcat = $("select[name='mod_fileformat']");

                for(i=0;i < result.length;i++)
                {
                    mcat.append($("<option>" + result[i] + "</option>"));
                }

                if(mcat.data("values") != undefined && mcat.data("values") != null)
                {
                    mcat.val(mcat.data("values"));
                }
                mcat.multiselect('refresh');

                $("select[name='fileformat']").each(function()
                {
                    console.log("Adding loaded file formats to parameters");
                    var fileformat = $(this);
                    $('select[name="mod_fileformat"]').children("option").each(function()
                    {
                        fileformat.append("<option>" + $(this).val() + "</option>");
                    });

                    if(fileformat.data("fileformats") != null && fileformat.data("fileformats") != "")
                    {
                        fileformat.val(fileformat.data("fileformats"));
                    }

                    fileformat.multiselect("refresh");
                });
            }
        },
        dataType: "json"
    });
}

function addsectioncollapseimages()
{
    $(".heading").each(function()
    {
        if($(this).find(".imgcollapse").length == 0 || $(this).find(".imgexpand").length == 0)
        {
            var imagecollapse = $("<img class='imgcollapse' src='styles/images/section_collapsearrow.png' alt='some_text' width='11' height='11'/>");
            var imageexpand = $("<img class='imgexpand' src='styles/images/section_expandarrow.png' alt='some_text' width='11' height='11'/>");

            $(this).prepend(imageexpand);
            $(this).prepend(imagecollapse);

            $(this).children(".imgcollapse").toggle();

            $(this).next(".hcontent").data("visible", true);
         }
    });
}


function htmlEncode(value)
{
    return $('<div/>').text(value).html();
}

function loadModuleInfo(module)
{
    module_editor.lsid = module["LSID"];
    $("#lsid").empty().append("LSID: " + module_editor.lsid);

    if(module["name"] !== undefined)
    {
        $('#modtitle').val(module["name"]);
    }

    if(module["lsidVersions"] !== undefined)
    {
        updateModuleVersions(module["lsidVersions"]);
        $('select[name="modversion"]').val(module["LSID"]);
        $('select[name="modversion"]').multiselect("refresh");
    }

    if(module["description"] !== undefined)
    {
        $('textarea[name="description"]').val(module["description"]);
    }

    if(module["author"] !== undefined)
    {
        var author = module["author"];
        if(author.indexOf(";") != -1)
        {
            var results = author.split(";");
            author = results[0];
            var organization = results[1];

            $('input[name="author"]').val(author);
            $('input[name="organization"]').val(organization);
        }
        else
        {
            $('input[name="author"]').val(module["author"]);
        }
    }

    if(module["privacy"] !== undefined)
    {
        $('select[name="privacy"]').val(module["privacy"]);
        $('select[name="privacy"]').multiselect("refresh");
    }

    if(module["quality"] !== undefined)
    {
        $('select[name="quality"]').val(module["quality"]);
        $('select[name="quality"]').multiselect("refresh");
    }

    if(module["version"] !== undefined)
    {
        $('input[name="comment"]').val(module["version"]);
    }

    if(module["language"] !== undefined)
    {
        $('select[name="language"]').val(module["language"]);
        $('select[name="language"]').multiselect("refresh");

        if($('select[name="language"]').val() == null)
        {
            $('select[name="language"]').val("any");
            $('select[name="language"]').multiselect("refresh");
        }

        if(module["language"] == "Java")
        {
            $("select[name='c_type']").val(module["language"]);
            $("select[name='c_type']").multiselect("refresh");
            $("#commandtextarea textarea").data("type", "<java>");
        }
        if(module["language"] == "Perl")
        {
            $("select[name='c_type']").val(module["language"]);
            $("select[name='c_type']").multiselect("refresh");
            $("#commandtextarea textarea").data("type", "<perl>");
        }
    }

    if(module["os"] !== undefined)
    {
        $('input[name=os]').val(module["os"]);
    }

    if(module["taskType"] !== undefined)
    {
        $("select[name='category']").val(module["taskType"]);
        $("select[name='category']").multiselect("refresh");
    }

    if(module["cpuType"] !== undefined)
    {
        $("select[name='cpu']").val(module["cpuType"]);
        $("select[name='cpu']").multiselect("refresh");
    }

    if(module["commandLine"] !== undefined)
    {
        $('textarea[name="cmdtext"]').val(module["commandLine"]);

        var cmdtype = $("select[name='c_type']").val();
        if(cmdtype === "Custom" || cmdtype == null)
        {
            if(module["commandLine"].indexOf("<java>") != -1 &&
                module["commandLine"].indexOf("<java>") < 1)
            {
                $("select[name='c_type']").val("Java");
                $("select[name='c_type']").multiselect("refresh");
                $("#commandtextarea textarea").data("type", "<java>");
            }
            if(module["commandLine"].indexOf("<perl>") != -1 &&
                module["commandLine"].indexOf("<perl>") < 1)
            {
                $("select[name='c_type']").val("Perl");
                $("select[name='c_type']").multiselect("refresh");
                $("#commandtextarea textarea").data("type", "<perl>");
            }
        }
    }

    if(module["fileFormat"] !== undefined)
    {
        var fileformats = module["fileFormat"];
        fileformats = fileformats.split(";");
        $("select[name='mod_fileformat']").data("values", fileformats);
        $("select[name='mod_fileformat']").val(fileformats);
        $("select[name='mod_fileformat']").multiselect("refresh");
    }

    if(module["license"] !== undefined && module["license"] !== "")
    {
        var license = module["license"];
        module_editor.licensefile = license;

        //keep track of files that are already part of this module
        module_editor.currentUploadedFiles.push(license);

        var currentLicenseDiv = $("<div class='clear' id='currentLicenseDiv'></div>");

        var delbutton = $('<button value="' + license + '">x</button>&nbsp;');
        delbutton.button().click(function()
        {
            //set this so that module will update version when save button is clicked
            setDirty(true);

            var fileName = $(this).val();

            var confirmed = confirm("Are you sure you want to delete the license file: " + fileName);
            if(confirmed)
            {
                module_editor.licensefile = "";

                module_editor.filesToDelete.push(fileName);

                //remove display of uploaded license file
                $("#currentLicenseDiv").remove();

                $("#licenseDiv").show();
            }
        });

        currentLicenseDiv.append(delbutton);
        var licenseFileURL = "<a href=\"/gp/getFile.jsp?task=" + module_editor.lsid + "&file=" + encodeURI(license) + "\" target=\"new\">" + htmlEncode(license) + "</a> ";
        currentLicenseDiv.append(licenseFileURL);

        $("#licenseDiv").hide();
        $("#mainLicenseDiv").append(currentLicenseDiv);

    }

    //store remaining task info attributes
    $.each(module, function(keyName, value) {
        console.log("\nkeys: " + keyName);
        if(keyName != "fileFormat" && keyName != "commandLine" && keyName != "description"
            && keyName != "os" && keyName != "name" && keyName != "author" && keyName != "JVMLevel"
            && keyName != "LSID" && keyName != "lsidVersions" && keyName != "cpuType"
            && keyName != "privacy" && keyName != "language" && keyName != "version"
            && keyName != "supportFiles" && keyName != "taskType"
            && keyName != "quality" && keyName != "license")
        {
            module_editor.otherModAttrs[keyName] = module[keyName];
        }
    });

    var supportFilesList = module["supportFiles"];
    if(supportFilesList !== undefined && supportFilesList != null &&  supportFilesList != "")
    {
        var currentFilesDiv = $("<div id='currentfiles'><div>");
        currentFilesDiv.append("Current Files (Check to delete): ");

        $("#supportfilecontent").prepend(currentFilesDiv);

        // var currentFilesSelect = $("<select name='currentfiles' multiple='multiple'></select>");
        supportFilesList = supportFilesList.split(";");
        for(s=0;s<supportFilesList.length;s++)
        {
            //do not show the module manifest in the list of support files
            if(supportFilesList[s] == "manifest")
            {
                continue;
            }

            module_editor.currentUploadedFiles.push(supportFilesList[s]);

            var checkbox = $('<input type="checkbox" name="currentfiles" value="' +
                supportFilesList[s] + '" />').click(function()
                {
                    var selectedVal = $(this).val();

                    if($(this).is(':checked'))
                    {
                        module_editor.filesToDelete.push(selectedVal);
                    }
                    else
                    {
                        //check the attribute in case deleting from the file list fails
                        this.setAttribute("checked", "checked");
                        this.checked = true;
                        //remove from delete file list
                        removeFileToDelete(selectedVal);

                        this.setAttribute("checked", ""); // For IE
                        this.removeAttribute("checked");
                        this.checked = false;
                    }
                });

            currentFilesDiv.append(checkbox);

            var currentFileURL = "<a href=\"/gp/getFile.jsp?task=" + module_editor.lsid + "&file=" + encodeURI(supportFilesList[s]) + "\" target=\"new\">" + htmlEncode(supportFilesList[s]) + "</a> ";
            currentFilesDiv.append(currentFileURL);
        }

        currentFilesDiv.append("<br>");

        currentFilesDiv.append("<br><br>");
    }
}

function loadParameterInfo(parameters)
{
    for(i=0; i < parameters.length;i++)
    {
        var newParameter = addparameter();
        newParameter.find("input[name='p_name']").val(parameters[i].name);
        newParameter.find("textarea[name='p_description']").val(parameters[i].description);
        newParameter.find(".defaultValue").val(parameters[i].default_value);

        var optional = parameters[i].optional;
        var prefix = parameters[i].prefix;

        if(parameters[i].flag !== undefined && parameters[i].flag !== null)
        {
            newParameter.find("input[name='p_flag']").val(parameters[i].flag);
            if(newParameter.find("input[name='p_flag']").val() != "")
            {
                newParameter.find("input[name='p_prefix']").removeAttr("disabled");
            }
        }

        if(optional.length > 0)
        {
            newParameter.find("input[name='p_optional']").attr('checked', true);
        }

        if(prefix !== undefined && prefix !== null && prefix.length > 0)
        {
            newParameter.find("input[name='p_prefix']").attr('checked', true);
            newParameter.find("input[name='p_flag']").val(prefix);
        }

        var pfileformat = parameters[i].fileFormat;

        var type = parameters[i].type;

        if(type == "java.io.File")
        {
            newParameter.find("input[name='p_type']").val("Input File");
            newParameter.find("input[name='p_type']").multiselect("refresh");
            changeParameterType(newParameter.find("select[name='p_type']"));
        }

        if(type == "java.lang.Integer")
        {
            newParameter.find("select[name='p_type']").val("text");
            newParameter.find("select[name='p_type']").multiselect("refresh");
            changeParameterType(newParameter.find("select[name='p_type']"));
            newParameter.find("select[name='p_format']").val("Integer");
            newParameter.find("select[name='p_format']").multiselect("refresh");
            newParameter.find("select[name='p_format']").trigger('change');
        }
        if(type == "java.lang.Float")
        {
            newParameter.find("select[name='p_type']").val("text");
            newParameter.find("select[name='p_type']").multiselect("refresh");
            changeParameterType(newParameter.find("select[name='p_type']"));
            newParameter.find("select[name='p_format']").val("Floating Point");
            newParameter.find("select[name='p_format']").multiselect("refresh");
            newParameter.find("select[name='p_format']").trigger('change');
        }

        if(type == "PASSWORD")
        {
            newParameter.find("select[name='p_type']").val("text");
            newParameter.find("select[name='p_type']").multiselect("refresh");
            changeParameterType(newParameter.find("select[name='p_type']"));
            newParameter.find("select[name='p_format']").val("Password");
            newParameter.find("select[name='p_format']").multiselect("refresh");
            newParameter.find("select[name='p_format']").trigger('change');
        }

        if(type == "DIRECTORY")
        {
            newParameter.find("select[name='p_type']").val("text");
            newParameter.find("select[name='p_type']").multiselect("refresh");
            changeParameterType(newParameter.find("select[name='p_type']"));
            newParameter.find("select[name='p_format']").val("Directory");
            newParameter.find("select[name='p_format']").multiselect("refresh");
            newParameter.find("select[name='p_format']").trigger('change');
        }

        if(pfileformat !== undefined && pfileformat != null && pfileformat.length > 0)
        {
            newParameter.find("select[name='p_type']").val("Input File");
            newParameter.find("select[name='p_type']").multiselect("refresh");
            changeParameterType(newParameter.find("select[name='p_type']"));

            var pfileformatlist = pfileformat.split(";");
            newParameter.find("select[name='fileformat']").val(pfileformatlist);
            newParameter.find("select[name='fileformat']").data("fileformats", pfileformatlist);
            newParameter.find("select[name='fileformat']").multiselect('refresh');
        }

        var values = parameters[i].value;
        if(values !== undefined && values !== null && values.length > 0)
        {

            newParameter.find('input[name="choicelist"]').val(values);
            newParameter.find('input[name="choicelist"]').trigger("change");
        }

        var choices = parameters[i].choices;
        if(choices !== undefined && choices !== null && choices.length > 0)
        {

            newParameter.find('input[name="choicelist"]').val(choices);
            newParameter.find('input[name="choicelist"]').trigger("change");
        }

        var choiceDir = parameters[i].choiceDir;
        if(choiceDir !== undefined && choiceDir !== null && choiceDir.length > 0)
        {

            newParameter.find('input[name="choiceDir"]').val(choiceDir);
            newParameter.find('input[name="choiceDir"]').trigger("change");
        }

        var choiceDirFilter = parameters[i].choiceDirFilter;
        if(choiceDirFilter !== undefined && choiceDirFilter !== null && choiceDirFilter.length > 0)
        {

            newParameter.find('input[name="choiceDirFilter"]').val(choiceDirFilter);
            newParameter.find('input[name="choiceDirFilter"]').trigger("change");
        }

        var otherAttrs = {};
        $.each(parameters[i], function(keyName, value) {
            console.log("\nkeys: " + keyName);
            if(keyName != "name" && keyName != "description"
                && keyName != "flag" && keyName != "fileFormat"
                && keyName != "default_value" && keyName != "prefix" && keyName != "type"
                && keyName != "TYPE" && keyName != "MODE" && keyName != "optional" && keyName != "value"
                && keyName != "prefix_when_specified" && keyName != "choices"
                && keyName != "choiceDirFilter")
            {
                otherAttrs[keyName] = parameters[i][keyName];
            }
        });

        newParameter.data("otherAttrs", otherAttrs);
        updateparameter(newParameter, false);
    }
}

function loadModule(taskId)
{
    $.ajax({
        type: "POST",
        url: "/gp/ModuleCreator/load",
        data: { "lsid" : taskId },
        success: function(response) {
            var message = response["MESSAGE"];
            var error = response["ERROR"];
            var module = response["module"];

            if (error !== undefined && error !== null)
            {
                alert(error);

                if(error.indexOf("not editable") != -1)
                {
                    window.open("/gp/modules/creator.jsf", '_self');
                }
            }
            if (message !== undefined && message !== null) {
                alert(message);
            }
            loadModuleInfo(response["module"]);
            loadParameterInfo(response["parameters"]);
            setDirty(false);
        },
        dataType: "json"
    });
}

function getParametersJSON()
{
    var parameters = [];
    var pnum = 0;
    $(".parameter").each(function()
    {
        pnum = pnum +1;
        var pname = $(this).find("input[name='p_name']").val();
        var description = $(this).find("textarea[name='p_description']").val();
        var type = $(this).find("select[name='p_type'] option:selected").val();
        var default_val = $(this).find(".defaultValue").val();
        var optional = $(this).find('input[name="p_optional"]').is(':checked') ? "on" : "";
        var fileformatlist = "";
        var mode = "";
        var prefix = "";
        var flag = "";

        if($(this).find('select[name="fileformat"]').val() !== undefined
            && $(this).find('select[name="fileformat"]').val() !== null)
        {
            var fileformat = $(this).find('select[name="fileformat"]').val();
            for(var f=0;f< fileformat.length;f++)
            {
                fileformatlist = fileformatlist + fileformat[f];
                if(f+1 < fileformat.length)
                {
                    fileformatlist = fileformatlist + ";";
                }
            }
        }

        if($(this).find("input[name='p_flag']").val() != undefined && $(this).find("input[name='p_flag']").val() !== null)
        {
            flag = $(this).find("input[name='p_flag']").val();
        }

        if(pname == undefined || pname == null || pname.length < 1)
        {
            saveError("A parameter name must be specified for parameter number " + pnum);
            throw("A parameter name is missing");
        }
        //this is an input file type
        if(type === "Input File")
        {
            mode = "IN";
            type = "FILE";
        }
        else
        {
            var format = $(this).find("select[name='p_format'] option:selected").val();
            if(format === "Directory")
            {
                type = "DIRECTORY";
            }
            else if(format === "Password")
            {
                type = "PASSWORD";
            }
            else if(format === "Integer")
            {
                type = "Integer";
            }
            else if(format === "Floating Point")
            {
                type = "Floating Point";
            }
            else
            {
                type = "TEXT";
            }
        }

        if($(this).find('input[name="p_prefix"]').is(":checked"))
        {
            prefix = $(this).find('input[name="p_flag"]').val();
        }

        var parameter = {
            "name": pname, "description": description, "TYPE": type,
            "default_value": default_val, "optional": optional,
            "fileFormat": fileformatlist, "MODE": mode, "prefix": prefix, "flag": flag
        };

        parameter["value"] = "";

        //there are choices defined
        if($(this).find('input[name="choicelist"]').val().length > 0)
        {
            parameter["value"] = $(this).find('input[name="choicelist"]').val();
            if(type == "FILE")
            {
                parameter["choices"] = $(this).find('input[name="choicelist"]').val();
            }
        }

        if($(this).find('input[name="choiceDir"]').val().length > 0)
        {
            parameter["choiceDir"] = ($(this).find('input[name="choiceDir"]').val());
        }

        if($(this).find('input[name="choiceDirFilter"]').val().length > 0)
        {
            parameter["choiceDirFilter"] = ($(this).find('input[name="choiceDirFilter"]').val());
        }

        //add other remaining attributes
        var otherAttrs = $(this).data("otherAttrs");
        if (otherAttrs !== undefined && otherAttrs !== null) {
            $.each(otherAttrs, function(keyName, value) {
                parameter[keyName] =  otherAttrs[keyName];
                console.log("\nsaving other parameter attributes: " + keyName + "=" + otherAttrs[keyName]);
            });
        }

        parameters.push(parameter);
    });

    return(parameters);
}


function saveAndUpload(runModule)
{
    if(saving)
    {
        return;
    }

    saving = true;

    $("#savingDialog").empty();

    $('<div/>').progressbar({ value: 100 }).appendTo("#savingDialog");

    $("#savingDialog").dialog({
        autoOpen: true,
        modal: true,
        height:130,
        width: 400,
        title: "Saving Module",
        open: function()
        {
            $(".ui-dialog-titlebar-close").hide();
        }
    });

    run = runModule;
    //if no support files need to be upload then skip upload file step
    if(module_editor.filestoupload.length == 0)
    {
        saveModule();
    }
    else
    {
        uploadAllFiles();
    }
}

function uploadAllFiles()
{
    if (module_editor.filestoupload.length)
    {
        var nextFile = module_editor.filestoupload.shift();

        uploadFile(nextFile);
    }
    else
    {
        saveModule();
    }
}

function validateDefaultChoiceValue(defaultValueObj)
{
    var defaultValue = defaultValueObj.val();

    if(defaultValue == undefined || defaultValue == null || defaultValue.length < 1)
    {
        return;
    }

    var choiceValues = [];
    //we are validating that the default value is valid if this parameter is a drop down
    var parent = defaultValueObj.closest(".parameter");

    var choiceParameter = parent.find("input[name='choicelist']");
    if(choiceParameter !== undefined && choiceParameter !== null)
    {
        var choicelist = choiceParameter.val();
        if(choicelist == undefined || choicelist == null)
        {
            return;
        }

        var choices = choicelist.split(';');
        for(var i=0;i<choices.length;i++)
        {
            var rowdata = choices[i].split("=");
            if(rowdata != undefined && rowdata != null && rowdata.length > 0)
            {
                choiceValues.push(rowdata[0]);
                if(rowdata[0] == defaultValue)
                {
                    return;
                }
            }
        }
    }

    //enforce default value if this is a text input parameter
    if(!parent.find("select[name='p_type']").val().equals("Input File"))
    {
        defaultValueObj.val("");
        alert("Default value \"" + defaultValue + "\" could not be found in the list of possible input values:\n" + choiceValues.join(', ') + "\n\nPlease enter a valid default value.");
    }
}

jQuery(document).ready(function() {

    $("input[type='text']").val("");

    addsectioncollapseimages();
    updatemodulecategories();
    updatefileformats();

    //check if this is a request to edit an existing module
    editModule();

    $(".heading").live("click", function()
    {
        var visible = $(this).next(".hcontent").data("visible");
        //if first time then content is visible
        if(visible == undefined)
        {
            visible = true;
        }

        $(this).next(".hcontent").slideToggle(340);
        $(this).children(".imgcollapse:first").toggle();
        $(this).children(".imgexpand:first").toggle();

        //visibilty has changed to the opposite
        $(this).next(".hcontent").data("visible", !visible);
    });

    $(".hcontent").show();

    mainLayout = $('body').layout({

        //	enable showOverflow on west-pane so CSS popups will overlap north pane
        west__showOverflowOnHover: false

        //	reference only - these options are NOT required because 'true' is the default
        ,	closable:				true
        ,	resizable:				true	// when open, pane can be resized
        ,	slidable:				true	// when closed, pane can 'slide' open over other panes - closes on mouse-out

        //	some resizing/toggling settings
        ,	north__slidable:		false	// OVERRIDE the pane-default of 'slidable=true'
        ,	north__spacing_open:	0		// no resizer-bar when open (zero height)
        ,	north__spacing_closed:	20		// big resizer-bar when open (zero height)
        ,	south__spacing_open:	0

        ,	south__slidable:		false	// OVERRIDE the pane-default of 'slidable=true'
        //some pane-size settings
        ,	north__minHeight:		80
        ,	north__height:		    80
        ,	south__minHeight:		40
        ,	west__size:			    360
        ,	east__size:				300
        ,	south__size:		    34
        ,	center__minWidth:		100
        ,	useStateCookie:			true
    });

    $( "#parameters" ).sortable(
        {
            change: function(event, ui)
            {
                setDirty(true);
            }
        });

    $( "#commandlist" ).sortable();

    $("#addone").button().click(function()
    {
        addparameter();
    });

    $("#addparamnum").val("1");
    $("#addmultiple").button().click(function()
    {
        var numparams = $("#addparamnum").val();
        for(i=0;i<numparams;i++)
        {
            addparameter();
        }
    });


    $("input[name='p_flag']").live("keyup", function()
    {
        var parameterParent = $(this).parents(".parameter");

        var p_prefix = parameterParent.find("input[name='p_prefix']");
        var p_flag = parameterParent.find("input[name='p_flag']");

        if(p_flag.val() !== undefined && p_flag.val() !== null)
        {
            if(p_flag.val() !== "")
            {
                p_prefix.removeAttr("disabled");
            }
            else
            {
                p_prefix.attr("disabled", true);
            }
        }
    });

    $("input[name='p_name'], input[name='p_flag'], input[name='p_prefix']").live("change", function()
    {
        var parameterParent = $(this).parents(".parameter");

        updateparameter(parameterParent);
    });


    $('#commandpreview').children().button().click(function()
    {
        var cmd_args = $('#commandlist').text();

        $("#commandtextarea textarea").attr("value", cmd_args);
        $("#commandtextarea").toggle();
    });

    //check for invalid chars ; and = in parameter choice list
    $("input[name='choicen'], input[name='choicev']").live("keyup", function()
    {
        if($(this).val().indexOf(";") != -1 || $(this).val().indexOf("=") != -1)
        {
            alert("The characters = and ; are not allowed");
            $(this).val("");
        }
    });

    $( "#addmodcategorydialog" ).dialog({
        autoOpen: false,
        height: 210,
        width: 330,
        buttons: {
            "OK": function() {
                var category = $("#newcategoryname").val();
                var newcategory = $("<option>" +category + "</option>");
                $("select[name='category']").append(newcategory);
                $("select[name='category']").val(category);
                $("select[name='category']").multiselect("refresh");
                $( this ).dialog( "close" );
            },
            "Cancel": function() {
                $( this ).dialog( "close" );
            }
        },
        resizable: false
    });

    $("#addcategory").button().click(function()
    {
        $( "#addmodcategorydialog" ).dialog("open");
    });


    $( "#addfileformatdialog" ).dialog({
        autoOpen: false,
        height: 210,
        width: 330,
        buttons: {
            "OK": function() {
                var fileformat = $("#newfileformat").val();
                fileformat = trim(fileformat);

                $("#newfileformat").val("");
                if(fileformat != "")
                {
                    var newfileformat = $("<option value='" + fileformat + "'>" + fileformat + "</option>");

                    var exists = false;
                    //check if fileformat already exists
                    //append to parameter input file format
                    $("select[name='mod_fileformat']").children().each(function()
                    {
                        if($(this).val() == fileformat)
                        {
                            exists = true;
                        }
                    });

                    if(exists)
                    {
                        alert("The file format " + fileformat + " already exists");
                        return;
                    }


                    $("select[name='fileformat']").append(newfileformat);
                    $("select[name='fileformat']").multiselect("refresh");

                    //append to module output file format
                    var modnewfileformat = $("<option value='" + fileformat + "'>" + fileformat + "</option>");
                    $("select[name='mod_fileformat']").append(modnewfileformat);
                    $("select[name='mod_fileformat']").multiselect("refresh");
                }
                $( this ).dialog( "close" );
            },
            "Cancel": function() {
                $("#newfileformat").val("");
                $( this ).dialog( "close" );
            }
        },
        resizable: false
    });


    $("#addfileformat").button().click(function()
    {
        $( "#addfileformatdialog" ).dialog("open");
    });

    $("#viewparameter").button().click(function()
    {
        var listing = [];

        $("#commandlist").children("li").each(function()
        {
            listing.push($(this).text());
        });

        $("#commandlist").data("prevlisting", listing);

        $( "#clistdialog" ).dialog("open");
    });

    $( "#clistdialog" ).dialog({
        autoOpen: false,
        height: 440,
        width: 340,
        buttons: {
            "OK": function()
            {
                var prev = $("#commandlist").data("prevlisting");

                var cur = [];
                $("#commandlist").children("li").each(function()
                {
                    cur.push($(this).text());
                });

                //Reorder the parameters in the command line
                if(prev !== cur)
                {
                    var cmdline = $("#commandtextarea textarea").val();

                    for(p=0; p <prev.length; p++)
                    {
                        cmdline = cmdline.replace(prev[p], "+++" + p + "***");
                    }

                    for(p=0;p<prev.length;p++)
                    {
                        cmdline = cmdline.replace("+++" + p + "***", cur[p]);
                    }
                }

                $("#commandtextarea textarea").val(cmdline);
                $( this ).dialog( "close" );
            }
        },
        resizable: true
    });

    $('#savebtn').button().click(function()
    {
        if(!isDirty())
        {
            alert("No changes to save");
        }
        else
        {
            saveAndUpload(false);
        }
    });

    $('#saveRunbtn').button().click(function()
    {
        //no changes detected so skip to run step
        if(!isDirty() && module_editor.lsid != "")
        {
            runModule(module_editor.lsid);
        }
        else
        {
            // save and then run the module
            saveAndUpload(true);
        }
    });

    $('#publishGParc').button().click(function() {
    	var token = null;
    	var buttons = {
                "Submit to GParc": function() {
                	$(this).dialog("close");
                	
                	var afterHTML = "<div><div style='width:100%;text-align:center;'><img id='gparcUploadProgress' style='height: 32px; margin: 10px;' src='/gp/images/runningJob.gif'/></div>" + 
                			"<div id='gparcInfoText'>Uploading your module to GParc</div></div>";
                	var afterButtons = {"Confirm on GParc": function() {
                		window.open(token);
                	}};

                	showDialog("Uploading to GParc. Please Wait...", $(afterHTML), afterButtons);
                	setTimeout(function() {
        				$(".ui-dialog-buttonset > button:visible").button("disable");
        			}, 100);
                    
                    $.ajax({
                        type: "GET",
                        dataType: "json",
                        url: "/gp/ModuleCreator/gparc?lsid=" + module_editor.lsid,
                        success: function(response) {
                        	if (response.token) {
                        		token = response.token;
                            	$("#gparcUploadProgress").attr("src", "/gp/images/checkbox.gif");
                            	var successHTML = 'Your module has been uploaded to GParc. Please click the button below to log into GParc and finalize your submission.<br/><br/>' +
                            		  '<em>Remember, in order to finish the submission you will need to a GParc account and will need to be logged in. This account is different ' + 
    		          				  'from your GenePattern account.</em>' + 
    		          				  '<ul><li>To register for a GParc account <a href="http://www.broadinstitute.org/software/gparc/user/register" target="_blank" style="text-decoration: underline; color: #000099;">click here</a>.</li>' + 
    		          				  '<li>To log in to GParc <a href="http://www.broadinstitute.org/software/gparc/user" target="_blank" style="text-decoration: underline; color: #000099;">click here</a>.</li></ul>' + 
    		          				  'Once you have logged in, click "Confirm on GParc" below.</div>';
                            	$("#gparcInfoText").html(successHTML);
                            	setTimeout(function() {
                    				$(".ui-dialog-buttonset > button:visible").button("enable");
                    			}, 101);
                        	}
                        	else {
                        		token = response.error;
                            	$("#gparcUploadProgress").attr("src", "/gp/images/error.gif");
                            	var successHTML = 'There was an error submitting your module to GParc. ' + token;
                            	$("#gparcInfoText").text(successHTML);
                        	}
                        },
                        error: function(error) {
                        	alert(error);
                        }
                    });
                }
    		};
    	var dialogHTML = '<div><a href="http://gparc.org"><img src="styles/images/gparc.png" alt="GParc" style="margin-bottom: 10px;" /></a><br />\
			<strong>GParc</strong> is a repository and community where users can share and discuss their own GenePattern modules.<br/><br/>';

        if (isDirty()) {
            dialogHTML += '<img src="styles/images/alert.gif" alt="Alert" /> <span style="color:red;">Changes to this module must be saved before it can be submitted to GParc.</span><br/><br/>';
        }

        if (!hasDocFiles()) {
            dialogHTML += '<img src="styles/images/alert.gif" alt="Alert" /> <span style="color:red;">This module does not yet have attached documentation.</span><br/><br/>\
    			In order to submit a module to GParc the module will need to have attached documentation.<br/><br/>';
        }

    	dialogHTML += 'To submit a module to GParc please click the Submit to GParc button below and wait for your module to be uploaded.<br/><br/>' +
    				  '<em>In order to finish the submission you will need a GParc account and will need to be logged in. This account is different ' + 
    				  'from your GenePattern account.</em>' + 
    				  '<ul><li>To register for a GParc account <a href="http://www.broadinstitute.org/software/gparc/user/register" target="_blank" style="text-decoration: underline; color: #000099;">click here</a>.</li>' + 
    				  '<li>To log in to GParc <a href="http://www.broadinstitute.org/software/gparc/user" target="_blank" style="text-decoration: underline; color: #000099;">click here</a>.</li></ul></div>';
    	if (!hasDocFiles() || isDirty()) {
    		setTimeout(function() {
				$(".ui-dialog-buttonset > button:visible").button("disable");
			}, 100);
    	}
    	showDialog("Submit Module to GParc", $(dialogHTML), buttons);
    });

    $('#whatIsGparc').click(function(event) {
        showDialog("What is GParc?", '<a href="http://gparc.org"><img src="styles/images/gparc.png" alt="GParc" style="margin-bottom: 10px;"'+
            '/></a><br /><strong>GParc</strong> is a repository and community where users can share and discuss their own GenePattern modules.'+
            '<br/><br/>Unregistered users can download modules and rate them.  Registered GParc users can:<ul><li>Submit modules</li>'+
            '<li>Download modules</li><li>Rate modules</li><li>Comment on modules</li><li>Access the GParc forum</ul>');
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
    });


    $("select[name='c_type']").change(function()
    {
        var cmdlinetext = $("#commandtextarea textarea").val();
        var type = $(this).val();
        type = type.toLowerCase();

        var prev_cmd = $("#commandtextarea textarea").data("type");

        cmdlinetext = cmdlinetext.replace(prev_cmd, "");
        if(type == "java")
        {
            cmdlinetext = "<java>" + cmdlinetext;
        }
        else if(type == "perl")
        {
            cmdlinetext = "<perl>" + cmdlinetext;
        }


        $("#commandtextarea textarea").data("type", "<" + type +">");
        $("#commandtextarea textarea").val(cmdlinetext);
    });

    $(".licensefile").change(function()
    {

        if(this.files[0].type != "text/plain")
        {
            alert("ERROR: License file must be a text file");
            return;
        }

        if(this.files[0].size > 1024 * 1024 * 1024)
        {
            alert("ERROR: License file cannot be > 1GB");
            return;
        }

        //add to list of files to upload files
        addFileToUpload(this.files[0]);


        var delbutton = $('<button value="' + this.files[0].name + '">x</button>&nbsp;');

        delbutton.button().click(function()
        {
            //remove the license file from the list of files to upload
            removeFileToUpload($(this).val());

            module_editor.licensefile = "";

            //remove display of uploaded license file
            $("#licenseFileNameDiv").remove();

            //show the button to upload a new file
            $(".licensefile").parents("span").show();
        });

        module_editor.licensefile = this.files[0].name;

        var licenseFileNameDiv = $("<div id='licenseFileNameDiv' class='clear'>" + this.files[0].name
            + " (" + bytesToSize(this.files[0].size) + ")" +"</div>");
        licenseFileNameDiv.prepend(delbutton);

        //hide the button to upload a new file
        $(this).parents("span").hide();

        $("#licenseDiv").append(licenseFileNameDiv);

    });

    $(".supportfile").live("change", function()
    {
        addToSupportFileList(this.files[0]);

        //add a new file input field
        $(this).attr('name', "name" + module_editor.filestoupload.length);
        var parent = $(this).parent();
        parent.append('<input type="file" class="supportfile">');
        $(this).detach();
    });

    $("select[name='mod_fileformat']").multiselect({
        header: false,
        noneSelectedText: "Specify output file formats",
        selectedList: 4 // 0-based index
    });

    $("select[name='category'], select[name='privacy'], select[name='quality'], " +
        "select[name='c_type'], select[name='cpu'], select[name='language'], select[name='modversion']").multiselect({
            multiple: false,
            header: false,
            selectedList: 1
        });

    $("#helpbtn").button().click(function()
    {
        window.open('createhelp.jsp#editingPropertiesHelp', '_blank');
    });

    $("#modtitle").change(function()
    {
        var modtitle = $("#modtitle").val();
        if(modtitle.indexOf(" ") != -1)
        {
            modtitle = modtitle.replace(/ /g, ".");
            $("#modtitle").val(modtitle);
        }
    });

    $(".defaultValue").live("change", function()
    {
        validateDefaultChoiceValue($(this));
    });

    $("body").change(function()
    {
        setDirty(true);
    });

    //area for dropping support files
    var dropbox = document.getElementById("dropbox");

    // init event handlers
    dropbox.addEventListener("dragenter", dragEnter, true);
    dropbox.addEventListener("dragleave", dragLeave, true);
    dropbox.addEventListener("dragexit", dragExit, false);
    dropbox.addEventListener("dragover", dragOver, false);
    dropbox.addEventListener("drop", drop, false);

    //disable default browser behavior of opening files using drag and drop
    $(document).bind({
        dragenter: function (e) {
            e.stopPropagation();
            e.preventDefault();
            var dt = e.originalEvent.dataTransfer;
            dt.effectAllowed = dt.dropEffect = 'none';
        },
        dragover: function (e) {
            e.stopPropagation();
            e.preventDefault();
            var dt = e.originalEvent.dataTransfer;
            dt.effectAllowed = dt.dropEffect = 'none';
        }
    });
});

function dragEnter(evt)
{
    $("#dropbox").addClass("highlight");
    evt.stopPropagation();
    evt.preventDefault();
}

function dragLeave(evt)
{
    $("#dropbox").removeClass("highlight");
    evt.stopPropagation();
    evt.preventDefault();
}

function dragExit(evt)
{
    evt.stopPropagation();
    evt.preventDefault();
}

function dragOver(evt)
{
    evt.stopPropagation();
    evt.preventDefault();
}

function drop(evt)
{

    $("#dropbox").removeClass("highlight");
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files;
    var count = files.length;

    // Only call the handler if 1 or more files was dropped.
    if (count > 0)
        handleFiles(files);
}

function addFileToUpload(file)
{
    if(file.name == "manifest")
    {
        alert("You are not allowed to upload files with file name 'manifest'. Please re-name your file and try again.");
        throw("You are not allowed to upload files with file name 'manifest'. Please re-name your file and try again.");
    }

    for(i=0;i<module_editor.filestoupload.length;i++)
    {
        var upLoadFile = module_editor.filestoupload[i].name;
        if(upLoadFile === file.name)
        {
            alert("ERROR: The file " + file.name + " has already been specified for upload. Please remove the file first.")
            throw("ERROR: The file " + file.name + " has already been specified for upload. Please remove the file first.")
        }
    }

    //Now check if the file is in the list of current files in the module
    for(i=0;i<module_editor.currentUploadedFiles.length;i++)
    {
        console.log("current files: " + module_editor.currentUploadedFiles[i]);
        if(module_editor.currentUploadedFiles[i] == file.name)
        {
            //check if file was marked for deletion
            var index = jQuery.inArray(file.name, module_editor.filesToDelete);
            if(index == -1)
            {
                alert("ERROR: The file" + file.name + " already exists in the module. " +
                    "Please remove the file first.");
                throw("ERROR: The file" + file.name + " already exists in the module. " +
                    "Please remove the file first.");
            }
        }
    }

    //if you make it here then this is a new file to upload
    module_editor.filestoupload.push(file);
}

function removeFileToUpload(fileName)
{
    var index = -1;
    for(var i=0;i<module_editor.filestoupload.length;i++)
    {
        var value = module_editor.filestoupload[i].name;
        if(value === fileName)
        {
            index = i;
        }
    }

    if(index == -1)
    {
        //do nothing, unable to find file in support listing
        alert("An error occurred while removing file: File not found");
        return;
    }

    module_editor.filestoupload.splice(index,1);
}

function removeFileToDelete(fileName)
{
    //check if file was re-uploaded as a new file
    var index = -1;
    for(var i=0;i<module_editor.filestoupload.length;i++)
    {
        var value = module_editor.filestoupload[i].name;
        if(value === fileName)
        {
            index = i;
        }
    }

    //file was not re-uploaded so it is ok to leave it in the module
    if(index == -1)
    {
        var fIndex = jQuery.inArray(fileName, module_editor.filesToDelete);
        module_editor.filesToDelete.splice(fIndex,1);
    }
    else
    {
        alert("ERROR: The file " + fileName + " was specified for upload. Please remove the file from upload and try again.")
        throw("ERROR: The file " + fileName + " was specified for upload. Please remove the file from upload and try again.")
    }
}

function addToSupportFileList(file)
{
    if(file.name == "manifest")
    {
        alert("You are not allowed to upload files with file name 'manifest'. Please re-name your file and try again.");
        return;
    }

    addFileToUpload(file);

    setDirty(true);

    var sfilelist = $("<li>" + file.name + " (" + bytesToSize(file.size) + ")" + "</li>");
    sfilelist.data("fname", file.name);

    var delbutton = $("<button>x</button>&nbsp;");
    delbutton.button().click(function()
    {
        var selectedFileObj = $(this).parent().data("fname");

        removeFileToUpload(selectedFileObj);
        $(this).parent().remove();
    });

    sfilelist.prepend(delbutton);

    $("#supportfileslist").append(sfilelist);
}

function handleFiles(files)
{

    for(var i=0;i<files.length;i++)
    {
        addToSupportFileList(files[i]);
    }
}

var result = document.getElementById('result');

// upload file
function uploadFile(file)
{
    var destinationUrl = "/gp/ModuleCreator/upload";
    // prepare XMLHttpRequest
    var xhr = new XMLHttpRequest();
    xhr.open('POST', destinationUrl);
    xhr.onload = function() {
        console.log("on load response: " + this.responseText);

        var response = $.parseJSON(this.responseText);
        module_editor.uploadedfiles.push(response.location);

        uploadAllFiles();
    };
    xhr.onerror = function() {
        result.textContent = this.responseText;
        console.log("response: " + this.responseText);
    };
    xhr.upload.onprogress = function(event) {
        console.log("upload progress");
        //handleProgress(event);
    }
    xhr.upload.onloadstart = function(event) {
        console.log("onload start support file upload");
    }

    // prepare FormData
    var formData = new FormData();
    formData.append('myfile', file);
    xhr.send(formData);
}

function hasDocFiles() {
    var uploads = module_editor.currentUploadedFiles.length;
    var hasLicense = module_editor.licensefile !== "";
    if (hasLicense) { uploads--; }
    return uploads > 0;
}