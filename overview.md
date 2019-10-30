## About the NeuVector Container Security Platform

NeuVector delivers the only cloud-native Kubernetes security platform with uncompromising end-to-end protection from DevOps vulnerability protection to automated run-time security, and featuring a true Layer 7 container firewall.

NeuVector automates security for the entire CI/CD pipeline, from Build to Ship to Run. Use the Jenkins plug-in to scan during build, monitor images in registries and run automated tests for security compliance. Prevent deployment of vulnerable images with admission control, but also monitor production containers. All running containers and host OS’s are automatically scanned for vulnerabilities with scanning tasks distributed across hosts for blazing fast, highly scalable image vulnerability analysis. Scan thousands or hundreds of thousands of images with the fastest scanner available.

## About the NeuVector Azure DevOps Extension

The extension provides the following features:

* A **Image Vulnerability Scan** task integrates the NeuVector vulnerability scanner into an Azure DevOps Pipeline
* Perform vulnerability scans of a container image after its built and before its deployment either
  1. using an existing NeuVector Controller instance or
  2. using a NeuVector controller as a service container inside an Azure DevOps Pipeline
* Define thresholds for failing builds based on the number of detected vulnerabilities of different severities
* Provide a detailed report of an image scan for analysis in the build summary tab
* NeuVector controller instances to integrate are defined as service endpoints to decouple build pipeline definitions from credentials

## Highlighted Features

### Scan container images in build pipelines

* Add the **Image Vulnerability Scan** task to your Azure DevOps Pipeline to scan built container images for vulnerabilities.

<!-- ![NeuVector vulnerability scan task](screenshots/neuvector-scan-task.png) -->

### Detailed vulnerability report

* The **Image Vulnerability Scan** task outputs a detailed report of the scan in the summary tab of a build for analysis.

<!-- ![NeuVector vulnerability report in build summary](screenshots/neuvector-scan-task.png) -->

### Fail build pipelines on vulnerability detections

* In the **Image Vulnerability Scan** task, thresholds can be defined to fail a build based on the number of detected vulnerabilities of different severities.
* Also, explicit CVEs can be configured to fail the build when detected.

<!-- ![NeuVector vulnerability thresholds](screenshots/neuvector-service-endpoint.png) -->

### Integrate with existing NeuVector controller deployments

* Existing NeuVector controller deployments are defined as service endpoints
* NeuVector controller deployments can be referenced in build pipeline definitions

<!-- ![NeuVector controller service endpoint](screenshots/neuvector-service-endpoint.png) -->

<!-- ## Getting started -->

