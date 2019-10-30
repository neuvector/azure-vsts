# NeuVector extension for Azure DevOps Services

This project provides the NeuVector extension for Azure DevOps Services.

## Contents

### Task: NeuVectorScan


The extension provides the following Azure Pipelines tasks.

### Service Endpoint: NeuVector Controller

## Development requirements

The following prerequisite compontents must be installed on a development workstations.

- Docker
- Make

> All further requirements to build the Azure DevOps extension are contained in the container image specified in `Dockerfile`.

## Development container

Build the development container image:

```
make image
```

Start a development container with a shell:

```
make shell
```

All further commands are assumed to be executed within the development container shell.

As an alternative, the Visual Studio Code workspace can be opened with the [remote container feature](https://code.visualstudio.com/docs/remote/containers).

## Build

```
make dependencies
make build
```

## Test

```
make test
```

## Package

```
make package
```

The extension will be saved as a `.vsi` file to the folder `package`.

## Publish

- To publish the extension 

```
AZURE_DEVOPS_TOKEN
```

```
make publish
```
