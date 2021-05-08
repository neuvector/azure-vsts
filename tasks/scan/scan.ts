"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import tr = require('azure-pipelines-task-lib/toolrunner');
import * as ti from 'azure-pipelines-task-lib/internal';
import * as request from 'request-promise-native';
import * as helper from './helper';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidV4 } from 'uuid';

/**
 * Formats an API error message from a response instance.
 * 
 * @param error 
 */
function formatNeuVectorApiError(response: any): string {
    const error = response.error;

    let errorOut = "NeuVector Scanner API Error";

    if (error) {
        if (error.code) {
            errorOut += ` ${error.code}`;
        }

        if (error.error) {
            errorOut += ` ${error.error}`;
        }

        if (error.message) {
            errorOut += `: ${error.message}`;
        }
    }
    else {
        errorOut += ` with HTTP status ${response.statusCode}`;
    }

    return errorOut;
}

class NeuVectorApiClient {
    private readonly authEndpoint = "/v1/auth"

    private readonly scanRepositoryEndpoint = "/v1/scan/repository"

    // private readonly licenseEndpoint = "/v1/system/license"

    // private readonly updateLicenseEndpoint = "/v1/system/license/update"

    // private readonly authTokenHeader = "X-Auth-Token"

    private token = ""

    constructor(private readonly url: string, private readonly strictSsl: boolean) {

    }

    private getHeaders() {
        return {
            "X-Auth-Token": this.token
        };
    }

    public async isAvailable(): Promise<boolean> {
        try {
            const response = await request.get({
                baseUrl: this.url,
                uri: this.authEndpoint,
                json: true,
                resolveWithFullResponse: true,
                strictSSL: this.strictSsl
            });
        }
        catch (response) {
            return response.statusCode === 405 && response.error.error === 'Method not allowed';
        }

        return true;
    }

    public async authenticate(username: string, password: string) {
        const requestBody = {
            "password": {
                "username": username,
                "password": password
            }
        };

        const response = await request.post({
            baseUrl: this.url,
            uri: this.authEndpoint,
            json: true,
            body: requestBody,
            resolveWithFullResponse: true,
            strictSSL: this.strictSsl
        });

        this.token = (response.body as any).token.token;

        return response;
    }

    public async scanRepository(registry: string, username: string, password: string, repository: string, tag: string, scanLayers: boolean) {
        // The fields "username" and "password" are optional and can be empty
        const requestBody = {
            "request": {
                "registry": registry,
                "username": username,
                "password": password,
                "repository": repository,
                "tag": tag,
                "scan_layers": scanLayers
            }
        };

        return await request.post({
            baseUrl: this.url,
            uri: this.scanRepositoryEndpoint,
            json: true,
            body: requestBody,
            headers: this.getHeaders(),
            strictSSL: this.strictSsl
        });
    }

    public async scanLocalRepository(repository: string, tag: string, scanLayers: boolean) {
        // The fields "username" and "password" are optional and can be empty
        const requestBody = {
            "request": {
                "repository": repository,
                "tag": tag,
                "scan_layers": scanLayers
            }
        };

        return await request.post({
            baseUrl: this.url,
            uri: this.scanRepositoryEndpoint,
            json: true,
            body: requestBody,
            headers: this.getHeaders(),
            strictSSL: this.strictSsl
        });
    }

    // public async getLicense() {
    //     return await request.get({
    //         baseUrl: this.url,
    //         uri: this.licenseEndpoint,
    //         json: true,
    //         headers: this.getHeaders(),
    //         strictSSL: this.strictSsl
    //     });
    // }

    // public async updateLicense(licenseKey: string) {
    //     const requestBody = {
    //         "license_key": licenseKey
    //     };

    //     return await request.post({
    //         baseUrl: this.url,
    //         uri: this.updateLicenseEndpoint,
    //         json: true,
    //         body: requestBody,
    //         headers: this.getHeaders(),
    //         strictSSL: this.strictSsl
    //     });
    // }

    public async unauthenticate() {
        return await request.delete({
            baseUrl: this.url,
            uri: this.authEndpoint,
            json: true,
            headers: this.getHeaders(),
            strictSSL: this.strictSsl
        });
    }
}

async function run() {
    try {
        // Scanner type
        let standaloneScanner: boolean;

        const scanType: string = tl.getInput('scanType', true)!;

        if (scanType == 'external') {
            standaloneScanner = false;
        }
        else if (scanType == 'standalone') {
            standaloneScanner = true;
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'Invalid scanner type');
            return;
        }
    
        // Registry of the image to scan

        let registry = false
        let registryUrl = "";
        let registryUsername = "";
        let registryPassword = "";

        const registryEndpointId = tl.getInput('containerRegistry', false);

        if (registryEndpointId) {
            // Retrieve details of the provided registry endpoint
            registry = true;

            // Registry type
            var registryType = tl.getEndpointDataParameter(registryEndpointId, "registrytype", true);
    
            if (registryType === "ACR") {
                // TODO implement service principal authentication for Azure Container Registry
                tl.setResult(tl.TaskResult.Failed, 'Image scan in Azure Container Registry with service principal authentication is currently not implemented.');
    
                return;
            }
            else {
                const registryAuth = tl.getEndpointAuthorization(registryEndpointId, false);
    
                try {
                    const registryAuthParams = registryAuth!.parameters;
    
                    registryUrl = registryAuthParams["registry"];
                    registryUsername = registryAuthParams["username"];
                    registryPassword = registryAuthParams["password"];
                }
                catch (error) {
                    tl.error(error);
                    tl.setResult(tl.TaskResult.Failed, `Failed to obtain registry credentials from service connection ${registryEndpointId}`);
                    return;
                }
            }
        }
        else {
            // If a registry endpoint has not been provided, scan the local image
            registry = false;
        }

        const repository: string = tl.getInput('repository', true)!;
        const tag: string = tl.getInput('tag', true)!;
        const scanLayers: boolean = tl.getBoolInput('scanLayers', false)!;

        // High vulnerability threshold
        const failOnHighSeverityThreshold = tl.getBoolInput('failOnHighSeverityThreshold');
        const highSeverityThreshold = tl.getInput('highSeverityThreshold', false);
        const highSeverityThresholdValue = highSeverityThreshold !== undefined ? +highSeverityThreshold : -1;

        // Medium vulnerability threshold
        const failOnMediumSeverityThreshold = tl.getBoolInput('failOnMediumSeverityThreshold');
        const mediumSeverityThreshold = tl.getInput('mediumSeverityThreshold', false);
        const mediumSeverityThresholdValue = mediumSeverityThreshold !== undefined ? +mediumSeverityThreshold : -1;

        // CVE black list
        const failOnCveBlackList = tl.getBoolInput('failOnCveBlackList');
        const cveBlacklistString = tl.getInput('cveBlacklist', false);

        let cveBlacklist: string[] = [];

        if (cveBlacklistString) {
            cveBlacklist = cveBlacklistString.split(/\r?\n/).map(function (cve) {
                return cve.trim();
            });
        }

        // Reports file path
        const reportJsonOutputPath = tl.getInput('reportJsonOutputPath', false);
        const reportMarkdownOutputPath = tl.getInput('reportMarkdownOutputPath', false);

        // Start image scan
        ti._writeLine('Start image scan');
        let report: any;

        if(standaloneScanner){
            // Standalone Scan
            let license = "";

            let nvRegistry = false
            let nvRegistryUrl = "";
            let nvRegistryUsername = "";
            let nvRegistryPassword = "";
            let nvRepository = "";
            let nvTag = "";

            const nvRegistryEndpointId = tl.getInput('nvContainerRegistry', false);
            if (nvRegistryEndpointId) {
                // Retrieve details of the provided registry endpoint
                nvRegistry = true;
    
                // Registry type
                var nvRegistryType = tl.getEndpointDataParameter(nvRegistryEndpointId, "registrytype", true);
        
                if (nvRegistryType === "ACR") {
                    // TODO implement service principal authentication for Azure Container Registry
                    tl.setResult(tl.TaskResult.Failed, 'Image scan in Azure Container Registry with service principal authentication is currently not implemented.');
                    return;
                }
                else {
                    const nvRegistryAuth = tl.getEndpointAuthorization(nvRegistryEndpointId, false);
        
                    try {
                        const nvRegistryAuthParams = nvRegistryAuth!.parameters;
        
                        nvRegistryUrl = nvRegistryAuthParams["registry"];
                        nvRegistryUsername = nvRegistryAuthParams["username"];
                        nvRegistryPassword = nvRegistryAuthParams["password"];
                    }
                    catch (error) {
                        tl.error(error);
                        tl.setResult(tl.TaskResult.Failed, `Failed to obtain registry credentials from service connection ${nvRegistryEndpointId}`);
                        return;
                    }
                }
            }
            else {
                // If the NeuVecrtor Scanner registry endpoint has not been provided, it won't pull NeuVector Scanner image from nvRegistry.
                nvRegistry = false;
            }

            // NeuVector scanner image
            nvRepository = tl.getInput('nvRepository', true)!;
            nvTag = tl.getInput('nvTag', true)!;

            // License path
            const licensePath: string = tl.getInput('license', true)!;

            if (!fs.existsSync(licensePath)) {
                tl.setResult(tl.TaskResult.Failed, `License file not found at "${licensePath}".`);
            }

            license = fs.readFileSync(licensePath).toString().trim();

            try {
                let failOnStderr:boolean = false;
                let mountPath = tl.getVariable('Pipeline.Workspace');
                let scannerName = uuidV4();

                let scannerRegistryUrlParam: string = registryUrl?"-e SCANNER_REGISTRY="+registryUrl:"";
                let scannerRegistryUserParam: string = registryUsername?"-e SCANNER_REGISTRY_USERNAME="+registryUsername:"";
                let scannerRegistryPasswordParam: string = registryPassword?"-e SCANNER_REGISTRY_PASSWORD="+registryPassword:"";

                let nvRegistryUrlParam: string = nvRegistryUrl?nvRegistryUrl.replace(/^https?:\/\//i, "").split('/')[0] + "/":"";

                let scanLayerParam: string = scanLayers?"-e SCANNER_SCAN_LAYERS=true":"";

                let script: string = `
                echo ${nvRegistryPassword} | docker login -u ${nvRegistryUsername} --password-stdin ${nvRegistryUrl} \n
                docker pull ${nvRegistryUrlParam}${nvRepository}:${nvTag} \n
                docker run --name ${scannerName} --rm ${scannerRegistryUrlParam} ${scannerRegistryUserParam} ${scannerRegistryPasswordParam} -e SCANNER_REPOSITORY=${repository} -e SCANNER_TAG=${tag} -e SCANNER_LICENSE=${license} -v /var/run/docker.sock:/var/run/docker.sock -v ${mountPath}:/var/neuvector ${scanLayerParam} ${nvRegistryUrlParam}${nvRepository}:${nvTag} \n
                docker logout \n
                docker images
                `;

                // console.log("script:"+script);

                let workingDirectory = tl.getVariable('Build.SourcesDirectory') || '' ;
            
                if (fs.existsSync(script)) {
                    script = `exec ${script}`;
                }
            
                // Write the script to disk.
                tl.assertAgent('2.115.0');
                let tempDirectory: string = tl.getVariable('agent.tempDirectory') || '';
                tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
                let filePath = path.join(tempDirectory, uuidV4() + '.sh');
                fs.writeFileSync(
                    filePath,
                    script, // Don't add a BOM. It causes the script to fail on some operating systems (e.g. on Ubuntu 14).
                    { encoding: 'utf8' });
            
                // Create the tool runner.
                let bash = tl.tool(tl.which('bash', true))
                    .arg('--noprofile')
                    .arg(`--norc`)
                    .arg(filePath);
                let options: tr.IExecOptions = {
                    cwd: workingDirectory,
                    failOnStdErr: false,
                    errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
                    outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
                    ignoreReturnCode: true
                };
            
                // Run bash.
                let exitCode: number = await bash.exec(options);
            
                let result = tl.TaskResult.Succeeded;

                let fileName = mountPath + "/scan_result.json";
                var obj = JSON.parse(fs.readFileSync(fileName, 'utf8'));
                report = obj.report;
            }
            catch (err) {
                tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
            }

        }else{

            // Remote Scan
            let remoteScannerUrl = "";
            let remoteScannerUsername = "";
            let remoteScannerPassword = "";
            let remoteScannerStrictSSL: boolean = false;     
            
            const remoteScannerEndpointId: string = tl.getInput('neuvectorScanner', true)!;

            remoteScannerUrl = tl.getEndpointUrl(remoteScannerEndpointId, false);
            remoteScannerUsername = tl.getEndpointAuthorizationParameter(remoteScannerEndpointId, 'username', false)!;
            remoteScannerPassword = tl.getEndpointAuthorizationParameter(remoteScannerEndpointId, 'password', false)!;
            remoteScannerStrictSSL = ('true' !== tl.getEndpointDataParameter(remoteScannerEndpointId, 'acceptUntrustedCerts', true));            

            // NeuVector API client
            const nvClient = new NeuVectorApiClient(remoteScannerUrl, remoteScannerStrictSSL);

            // Authenticate with remote NeuVector controller
            ti._writeLine('Authenticate with remote neuVector scanner');

            try {
                const authResponse = await nvClient.authenticate(remoteScannerUsername, remoteScannerPassword);
                ti._writeLine('Authenticated with NeuVector scanner')
            }
            catch (response) {
                tl.error(formatNeuVectorApiError(response))
                tl.setResult(tl.TaskResult.Failed, response.error.error);

                return;
            }

            // call API to scan
            console.log("call api to scan");
            while (true) {
                try {
                    let scanRepositoryResponse: any;

                    // Scan repository in external registry
                    scanRepositoryResponse = await nvClient.scanRepository(registryUrl, registryUsername, registryPassword, repository, tag, true);

                    console.dir(scanRepositoryResponse);

                    report = scanRepositoryResponse.report;

                    break;
                }
                catch (response) {
                    if (response.statusCode == 304) {
                        // Retry if http status code is 304 Not Modified
                        // The scan has not been completed
                        // No wait between the requests in the client since the API blocks
                        continue;
                    }

                    tl.error(formatNeuVectorApiError(response))
                    tl.setResult(tl.TaskResult.Failed, response.error.error);

                    return;
                }
            }

            ti._writeLine('Unauthenticate with NeuVector scanner')
            
            try {
                const unauthenticateResponse = nvClient.unauthenticate();
            }
            catch (response) {
                tl.error(formatNeuVectorApiError(response))
                tl.setResult(tl.TaskResult.Failed, response.error.error);

                return;
            }            

        }

        ti._writeLine('Completed image scan');

        // Evaluate report
        let vulnerabilityNames: Array<string> = [];
        let mediumVulnerabilities: Array<object> = [];
        let highVulnerabilities: Array<object> = [];

        for (let vulnerability of report.vulnerabilities) {
            vulnerabilityNames.push(vulnerability.name);
            const severity: string = vulnerability.severity.toLowerCase();
            if (severity == 'medium') {
                mediumVulnerabilities.push(vulnerability);
            }

            if (severity == 'high') {
                highVulnerabilities.push(vulnerability);
            }

            tl.warning(`Image is affected by ${severity} severity vulnerability ${vulnerability.name}`)
        }

        // Generate JSON report
        const jsonReport = JSON.stringify(report, null, 2)

        // Output Json report in build log
        //ti._writeLine(jsonReport);

        // Generate Markdown vulnerability report

        // Generate markdown report for the display in the build pipeline tab
        let mdReport = '';

        // Summary
        mdReport += '### Summary\n\n';
        mdReport += `Image | ${report.repository}:${report.tag}\n`;
        mdReport += '--- | ---\n';

        if (report.registry) {
            mdReport += `Registry | ${report.registry}\n`;
        }

        if (report.repository) {
            mdReport += `Repository | ${report.repository}\n`;
        }

        if (report.tag) {
            mdReport += `Tag | ${report.tag}\n`;
        }

        if (report.image_id) {
            mdReport += `Image ID | ${report.image_id}\n`;
        }

        if (report.digest) {
            mdReport += `Image Digest | ${report.digest}\n`;
        }

        if (report.base_os) {
            mdReport += `Base OS | ${report.base_os}\n`;
        }

        mdReport += '\n';

        // Vulnerabilities
        mdReport += '### Vulnerabilities\n\n';

        if (report.vulnerabilities && report.vulnerabilities.length > 0) {
            mdReport += 'Score | Name | Severity | Package name | Package version | Fixed version | Vectors | Description \n';
            mdReport += '--- | --- | --- | --- | --- | --- | --- | ---\n';

            for (let vulnerability of report.vulnerabilities) {
                mdReport += `${vulnerability.score} | [${vulnerability.name}](${vulnerability.link}) | ${vulnerability.severity} | ${vulnerability.package_name} | ${vulnerability.package_version} | ${vulnerability.fixed_version} | ${vulnerability.vectors} | ${vulnerability.description}\n`;
            }
        }
        else {
            mdReport += '> No vulnerabilities have been detected in the image.'
        }

        // Show markdown report in build summary tab
        // - the file name of the report is the image id to support multiple scan tasks in the same pipeline
        // - the report content does not container the h2 heading
        // - ${report.repository}:${report.tag} cannot be added to the "name" of the vso command due to a limited set of supported characters
        const mdSummaryReport = mdReport;
        const mdReportPath = helper.saveBuildSummary(mdSummaryReport, `${report.image_id}.md`);
        helper.uploadBuildSummary(mdReportPath, `NeuVector scan report`);

        // Show markdown report in build log
        ti._writeLine(mdReport);

        // Output Markdown report to file
        if (reportMarkdownOutputPath) {
            const mdOutputReport = `## NeuVector scan report\n\n${mdReport}`;
            helper.ensureDirExists(path.dirname(reportMarkdownOutputPath));
            fs.writeFileSync(reportMarkdownOutputPath, mdOutputReport);
        }

        // Output JSON report to file
        if (reportJsonOutputPath) {
            helper.ensureDirExists(path.dirname(reportJsonOutputPath));
            fs.writeFileSync(reportJsonOutputPath, jsonReport);
        }

        // Evaluate high severity threshold
        if (failOnHighSeverityThreshold) {
            ti._writeLine(`Require number of high severity vulnerabilities to be lower than ${highSeverityThreshold}`);

            const highVulnerabilityCount = highVulnerabilities.length;

            if (highVulnerabilityCount >= highSeverityThresholdValue) {
                tl.setResult(tl.TaskResult.Failed, `Failed due to ${highVulnerabilityCount} detected high severity vulnerabilities`)
            }
        }

        // Evaluate medium severity threshold
        if (failOnMediumSeverityThreshold) {
            ti._writeLine(`Require number of medium severity vulnerabilities to be lower than ${mediumSeverityThreshold}`);

            const mediumVulnerabilityCount = mediumVulnerabilities.length;

            if (mediumVulnerabilityCount >= mediumSeverityThresholdValue) {
                tl.setResult(tl.TaskResult.Failed, `Failed due to ${mediumVulnerabilityCount} detected medium severity vulnerabilities`)
            }
        }

        // Evaluate CVE blacklist
        if (failOnCveBlackList && cveBlacklist.length > 0) {
            ti._writeLine(`Test for blacklisted CVEs`);

            for (let vulnerability of report.vulnerabilities) {
                const vulnerabilityName = vulnerability['name'].toUpperCase();
                if (cveBlacklist.find(cve => cve.toUpperCase() == vulnerabilityName)) {
                    tl.setResult(tl.TaskResult.Failed, `Failed because the blacklisted CVE ${vulnerabilityName} has been detected`)
                }
            }
        }

    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();
