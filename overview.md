## About the NeuVector Container Security Platform

NeuVector delivers the only cloud-native Kubernetes security platform with uncompromising end-to-end protection from DevOps vulnerability protection to automated run-time security, and featuring a true Layer 7 container firewall.

NeuVector automates security for the entire CI/CD pipeline, from Build to Ship to Run. Use the Jenkins plug-in to scan during build, monitor images in registries and run automated tests for security compliance. Prevent deployment of vulnerable images with admission control, but also monitor production containers. All running containers and host OS’s are automatically scanned for vulnerabilities with scanning tasks distributed across hosts for blazing fast, highly scalable image vulnerability analysis. Scan thousands or hundreds of thousands of images with the fastest scanner available.

## About the NeuVector Azure DevOps Extension

The extension provides the following features:

* A **Scan image with NeuVector** task integrates the NeuVector vulnerability scanner into an Azure DevOps Pipeline.
* Perform vulnerability scans of a container image after the image build
  1. on an external NeuVector controller instance or
  2. on a local NeuVector controller instance which is running in service container inside a pipeline.
* Define thresholds for failing builds based on the number of detected vulnerabilities of different severities.
* Provide a detailed report of an image scan for analysis in the build summary tab.
* External NeuVector controller instances are defined as service endpoints to decouple build pipeline definitions from connection parameters and credentials.

## Highlighted Features

### Scan container images in build pipelines

* Add the **Scan image with NeuVector** task to your Azure DevOps Pipeline to scan container images which have been built in the current pipeline for vulnerabilities.

### Scan on external controller

* Perform scans on external NeuVector controller instances

![NeuVector vulnerability scan task](screenshots/task-external-scan.png)

### Scan on local pipeline controller

* Perform scans on a local NeuVector controller instance which is running in service container inside a pipeline

![NeuVector vulnerability scan task](screenshots/task-local-scan.png)

### Detailed vulnerability report

* The **Scan image with NeuVector** task provides a detailed scan report in the summary tab of a build for analysis.
* This allows developers to quickly investigate and mitigate detected vulnerabilities

![NeuVector vulnerability report in build summary](screenshots/report-summary.png)

### Fail build pipelines on vulnerability detections

The **Scan image with NeuVector** task allows to define quality gates and thresholds for a successful build based on the scan results.

* Fail on reaching as threshold of the number of detected medium and high severity vulnerabilities
* Fail on the detectionof explicit CVEs

![NeuVector vulnerability quality gates and thresholds](screenshots/task-thresholds.png)

### Integrate with external NeuVector controller instances

* External NeuVector controller instances are defined as service connection
* Connection parameters and credentials are configured only in the service connection
* YAML-based pipeline definitions can reference the service connection to the external NeuVector controller using an identifier

![NeuVector controller service connection](screenshots/service-connection.png)

## Getting started

### Scan an image on an external NeuVector controller

1. Configure the connection parameters and credentials of the NeuVector controller in a service connection

    * Refer to [Create a service connection](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml#create-a-service-connection)
    * In Azure DevOps, open the **Service connections** page from the project settings page.
    * Choose **+ New service connection** and select **NeuVector Controller**
    * Provide the URL, username and password to the controller

2. Add the **Scan image with NeuVector** task to your pipeline.

    * The following shows a configuration of the `NeuVectorScan` task which scans the image `library/alpine` in Dockerhub on the NeuVector controller defined by the service connection with the name `NeuVector on AKS`.

Example:

```yaml
- task: NeuVectorScan@1
  displayName: Scan image with NeuVector
  enabled: true
  inputs:
    controllerType: external
    neuvectorController: 'NeuVector on AKS'
    containerRegistry: 'Dockerhub'
    repository: 'library/alpine'
    tag: 'latest'
    failOnHighSeverityThreshold: false
    highSeverityThreshold: '2'
    failOnMediumSeverityThreshold: false
    mediumSeverityThreshold: '4'
```

<!-- ### Scan an image on a local controller -->
