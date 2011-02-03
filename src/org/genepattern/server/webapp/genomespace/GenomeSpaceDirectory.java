package org.genepattern.server.webapp.genomespace;

import java.io.File;
import java.util.*;

import org.genepattern.server.webapp.jsf.*;
import org.genepattern.util.SemanticUtil;
import org.genepattern.webservice.TaskInfo;
import org.genomespace.client.DataManagerClient;
import org.genomespace.datamanager.core.*;

public class GenomeSpaceDirectory {
    public GSFileMetadata dir;
    public String name;
    public List<GenomeSpaceFileInfo> gsFiles;
    public List<GenomeSpaceDirectory> gsDirectories;
    public int level = 0;
    public boolean expanded = true;
    private static final Comparator<KeyValuePair> COMPARATOR = new KeyValueComparator();

    
    private GenomeSpaceDirectory(){
        gsFiles = new ArrayList<GenomeSpaceFileInfo>();
        gsDirectories = new ArrayList<GenomeSpaceDirectory>();
    }
    
    public GenomeSpaceDirectory(GSFileMetadata adir , int level, DataManagerClient dmClient, Map<String, Set<TaskInfo>> kindToModules, GenomeSpaceBean genomeSpaceBean){
        this(); 
        this.dir = adir;
        name = adir.getName();
        this.level = level;
        GSDirectoryListing aDir = dmClient.list(adir);
        
//        for (GSFileMetadata aFile: aDir.findFiles()){
//            System.out.println("2. Add file " + aFile.getName()+ " to " + adir.getName());
//                   gsFiles.add(new GenomeSpaceFileInfo(aFile));
//        }
        for (GSFileMetadata gsdir: aDir.findDirectories()){
            System.out.println("2. Add dir " + gsdir.getName() + " to " + adir.getName());
                 gsDirectories.add(new GenomeSpaceDirectory(gsdir, level + 1, dmClient, kindToModules, genomeSpaceBean));
        }
        setGsFileList(aDir, kindToModules, genomeSpaceBean);
    }
    
    public GenomeSpaceDirectory(GSDirectoryListing aDir, DataManagerClient dmClient, Map<String, Set<TaskInfo>> kindToModules, GenomeSpaceBean genomeSpaceBean){
        this();
        dir = aDir.getDirectory();
        name = dir.getName();
       
        
//        for (GSFileMetadata aFile: aDir.findFiles()){
//            System.out.println("1. Add file " + aFile.getName()+ " to " + aDir.getDirectory().getName());
//            gsFiles.add(new GenomeSpaceFileInfo(aFile));
//        }
        for (GSFileMetadata gsdir: aDir.findDirectories()){
            System.out.println("1. Add dir " + gsdir.getName()+ " to " + aDir.getDirectory().getName());
                  gsDirectories.add(new GenomeSpaceDirectory(gsdir, level + 1, dmClient, kindToModules, genomeSpaceBean));
        }
        setGsFileList(aDir, kindToModules, genomeSpaceBean);
        
        
    }

    
    public void setGsFileList(GSDirectoryListing gsDirList, Map<String, Set<TaskInfo>> kindToModules, GenomeSpaceBean genomeSpaceBean) {
        this.gsFiles = new ArrayList<GenomeSpaceFileInfo>();
        for (GSFileMetadata afile: gsDirList.findFiles()){
            GenomeSpaceFileInfo info = new GenomeSpaceFileInfo(afile);
            this.gsFiles.add(info);
            info.setUrl(genomeSpaceBean.getFileURL(afile));
            
            String kind = SemanticUtil.getKind(new File(afile.getName()));
            Collection<TaskInfo> modules;
            List<KeyValuePair> moduleMenuItems = new ArrayList<KeyValuePair>();
            modules = kindToModules.get(kind);
           
            if (modules != null) {
                for (TaskInfo t : modules) {
                    KeyValuePair mi = new KeyValuePair(t.getShortName(), UIBeanHelper.encode(t.getLsid()));
                    moduleMenuItems.add(mi);
                }
                Collections.sort(moduleMenuItems, COMPARATOR);
            }
            info.setModuleMenuItems(moduleMenuItems);
            
            
        }
    
    }
    

    public GSFileMetadata getDir() {
        return dir;
    }


    public void setDir(GSFileMetadata dir) {
        this.dir = dir;
    }


    public String getName() {
        return name;
    }


    public void setName(String name) {
        this.name = name;
    }


    public List<GenomeSpaceFileInfo> getGsFiles() {
        return gsFiles;
    }


    public void setGsFiles(List<GenomeSpaceFileInfo> gsFiles) {
        this.gsFiles = gsFiles;
    }


    public List<GenomeSpaceDirectory> getGsDirectories() {
        return gsDirectories;
    }


    public void setGsDirectories(List<GenomeSpaceDirectory> gsDirectories) {
        this.gsDirectories = gsDirectories;
    }


    public int getLevel() {
        return level;
    }


    public void setLevel(int level) {
        this.level = level;
    }


    public boolean isExpanded() {
        return expanded;
    }


    public void setExpanded(boolean expanded) {
        this.expanded = expanded;
    }
    
    private static class KeyValueComparator implements Comparator<KeyValuePair> {

        public int compare(KeyValuePair o1, KeyValuePair o2) {
            return o1.getKey().compareToIgnoreCase(o2.getKey());
        }

    }

}
