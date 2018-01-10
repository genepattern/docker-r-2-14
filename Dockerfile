
# copyright 2017-2018 Regents of the University of California and the Broad Institute. All rights reserved.
FROM r-base:3.1.3

RUN mkdir /build
RUN mkdir -p /patches/rlib/2.14/site-library
COPY Cairo_1.5-9.tar.gz /build/Cairo_1.5-9.tar.gz
COPY sources.list /etc/apt/sources.list

RUN apt-get update && apt-get upgrade --yes && \
    apt-get install build-essential --yes && \
    apt-get install python-dev --yes && \
    apt-get install default-jre --yes && \
    apt-get install openjdk-7-jdk --yes && \
    wget --no-check-certificate https://bootstrap.pypa.io/get-pip.py && \
    python get-pip.py 
RUN pip install awscli 

RUN apt-get update && \
    apt-get install curl --yes && \
    apt-get install libfreetype6=2.5.2-3+deb8u2 --yes --force-yes && \
    apt-get install libfreetype6-dev --yes  --force-yes && \
    apt-get install libfontconfig1-dev --yes  --force-yes && \
    apt-get install libcairo2-dev --yes  --force-yes && \
    apt-get install libgtk2.0-dev --yes  --force-yes && \
    apt-get install -y xvfb --yes --force-yes && \
    apt-get install -y libxt-dev --yes  --force-yes
    

RUN  mkdir packages && \
    cd packages && \
    curl -O http://cran.r-project.org/src/base/R-2/R-2.14.2.tar.gz && \
    tar xvf R-2.14.2.tar.gz && \
    cd R-2.14.2 && \
    ./configure --with-x=no && \
    make && \
    make check && \
    make install && \
    apt-get install libxml2-dev --yes && \
    apt-get install libcurl4-gnutls-dev --yes && \
    R CMD INSTALL /build/Cairo_1.5-9.tar.gz
    

COPY common/container_scripts/misc/RunR.java /build/RunR.java

RUN  cd /build && \
    javac RunR.java 
     
COPY r214.site.libraries.zip /patches/rlib/
RUN cd /patches/rlib/ && \
    unzip r214.site.libraries.zip
    
COPY common/container_scripts/runLocal.sh /usr/local/bin/runLocal.sh
COPY Dockerfile /build/Dockerfile
COPY jobdef.json /build/jobdef.json
COPY common/container_scripts/installPackages.R-2 /build/source/installPackages.R
COPY common/container_scripts/runS3OnBatch.sh /usr/local/bin/runS3OnBatch.sh
COPY runS3Batch_prerun_custom.sh /usr/local/bin/runS3Batch_prerun_custom.sh
COPY runS3Batch_postrun_custom.sh /usr/local/bin/runS3Batch_postrun_custom.sh


RUN chmod a+x /usr/local/bin/runS3OnBatch.sh /usr/local/bin/runLocal.sh
CMD ["/usr/local/bin/runS3OnBatch.sh" ]

