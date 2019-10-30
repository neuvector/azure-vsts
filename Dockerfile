# syntax = docker/dockerfile:experimental
# https://hub.docker.com/_/node/
FROM node:10.16.3-buster-slim as base

# Configure apt
# - In the debian base image "/etc/apt/apt.conf.d/docker-clean" configures apt to clean up after each command; this is disabled since the docker cache mechanism is used for /var/cache/apt
RUN set -eux; \
    rm /etc/apt/apt.conf.d/docker-clean;

# Package index
RUN --mount=type=cache,id=neuvector-vsts-apt-cache,target=/var/cache/apt set -eux; \
    flock --exclusive /var/cache/apt/.buildkit-lock apt-get update;

# Packages
RUN --mount=type=cache,id=neuvector-vsts-apt-cache,target=/var/cache/apt set -eux; \
    flock --exclusive /var/cache/apt/.buildkit-lock apt-get install -y --no-install-recommends\
        make \
        apt-utils \
        dialog \
        git \
        procps \
        jq \
    ;

# Node packages
# - Typescript
# - TFS Cross Platform Command Line Interface (tfx-cli)
# - Mocha test runner

RUN --mount=type=cache,id=neuvector-vsts-yarn,target=/usr/local/share/.cache/yarn yarn global add \
    typescript \
    tfx-cli \
    mocha \
    node-gyp

# Provide node executable to azure-pipelines-task-lib/
# - The maintainers of azure-pipelines-task-lib have hardcoded the download of node into the class
# - Not being able to disable this download is a really bad practice
# - Since node is installed in this image, a symbolic link is created at the location at which azure-pipelines-task-lib MockTestRunner expects the node executable
# - This prevents a download of node by the azure-pipelines-task-lib MockTestRunner
# - For details, refer to https://github.com/microsoft/azure-pipelines-task-lib/blob/e5a622a92dd95b77b30daf5ce8ae8095301d2a2c/node/mock-test.ts#L288
RUN set -eux; \
    mkdir -p /root/azure-pipelines-task-lib/_download/node10/node-v10.15.1-linux-x64/bin; \
    ln -s /usr/local/bin/node /root/azure-pipelines-task-lib/_download/node10/node-v10.15.1-linux-x64/bin/node; \
    touch /root/azure-pipelines-task-lib/_download/node10.completed;