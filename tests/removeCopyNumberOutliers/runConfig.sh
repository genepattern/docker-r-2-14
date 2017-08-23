#!/bin/sh

TASKLIB=$PWD/src
INPUT_FILE_DIRECTORIES=$PWD/data
S3_ROOT=s3://moduleiotest
WORKING_DIR=$PWD/job_1111

RHOME=/packages/R-2.14.2/


COMMAND_LINE="Rscript --no-save --quiet --slave --no-restore $TASKLIB/removeOutliers.R $TASKLIB/ $TASKLIB/userDIR  /patches  mynah.sorted --input $INPUT_FILE_DIRECTORIES/mynah.sorted.cn --trailingN 5 --replacement NA --mult_tol 4 --add_tol 0.3 --outputdir ./"

DOCKER_CONTAINER=genepattern/docker-r-2-14

# aws batch only vars 
S3_ROOT=s3://moduleiotest
JOB_QUEUE=TedTest
JOB_DEFINITION_NAME="R214_Generic"
JOB_ID=gp_job_R214_helloWorld_$1




