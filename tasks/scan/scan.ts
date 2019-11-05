import * as tl from 'azure-pipelines-task-lib/task';
//import ti = require('azure-pipelines-task-lib/internal');
import * as ti from 'azure-pipelines-task-lib/internal';
import * as request from 'request-promise-native';
import * as helper from './helper';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Formats an API error message from a response instance.
 * 
 * @param error 
 */
function formatNeuVectorApiError(response: any): string {
    const error = response.error;

    let errorOut = "NeuVector Controller API Error";

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

    private readonly licenseEndpoint = "/v1/system/license"

    private readonly updateLicenseEndpoint = "/v1/system/license/update"

    private readonly authTokenHeader = "X-Auth-Token"

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

    public async getLicense() {
        return await request.get({
            baseUrl: this.url,
            uri: this.licenseEndpoint,
            json: true,
            headers: this.getHeaders(),
            strictSSL: this.strictSsl
        });
    }

    public async updateLicense(licenseKey: string) {
        const requestBody = {
            "license_key": licenseKey
        };

        return await request.post({
            baseUrl: this.url,
            uri: this.updateLicenseEndpoint,
            json: true,
            body: requestBody,
            headers: this.getHeaders(),
            strictSSL: this.strictSsl
        });
    }

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
        // Controller type
        let localController: boolean;

        const controllerType: string = tl.getInput('controllerType', true)!;

        if (controllerType == 'external') {
            localController = false;
        }
        else if (controllerType == 'local') {
            localController = true;
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'Invalid controller type');
            return;
        }

        // Controller
        let controllerUrl = "";
        let controllerUsername = "";
        let controllerPassword = "";
        let controllerStrictSSL: boolean = false;

        let controllerLicense = "";

        if (!localController) {
            // External controller
            const controllerEndpointId: string = tl.getInput('neuvectorController', true)!;

            controllerUrl = tl.getEndpointUrl(controllerEndpointId, false);
            controllerUsername = tl.getEndpointAuthorizationParameter(controllerEndpointId, 'username', false)!;
            controllerPassword = tl.getEndpointAuthorizationParameter(controllerEndpointId, 'password', false)!;
            controllerStrictSSL = ('true' !== tl.getEndpointDataParameter(controllerEndpointId, 'acceptUntrustedCerts', true));
        }
        else {
            // Local controller

            // Port of local controller
            const controllerPort: string = tl.getInput('controllerPort', true)!;

            controllerUrl = `https://127.0.0.1:${controllerPort}`;
            controllerUsername = 'admin';
            controllerPassword = 'admin';
            controllerStrictSSL = false;

            // License path
            const controllerLicensePath: string = tl.getInput('controllerLicense', true)!;

            if (!fs.existsSync(controllerLicensePath)) {
                tl.setResult(tl.TaskResult.Failed, `License file not found at "${controllerLicensePath}".`);
            }

            controllerLicense = fs.readFileSync(controllerLicensePath).toString().trim();
        }

        // Registry

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
            // If a registry endpoint has not been proved, scan on the local container host
            registry = false;
        }

        // Image
        const repository: string = tl.getInput('repository', true)!;
        const tag: string = tl.getInput('tag', true)!;

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

        // Reports
        const reportJsonOutputPath = tl.getInput('reportJsonOutputPath', false);
        const reportMarkdownOutputPath = tl.getInput('reportMarkdownOutputPath', false);

        // NeuVector API client
        const nvClient = new NeuVectorApiClient(controllerUrl, controllerStrictSSL);

        // Wait for controller to become available
        // - only if local scanning is used
        if (localController) {
            while (!(await nvClient.isAvailable())) {
                await helper.delay(1000);
                ti._writeLine('Wait for NeuVector controller to start');
            }
        }

        // Authenticate with NeuVector controller
        ti._writeLine('Authenticate with NeuVector controller');

        try {
            const authResponse = await nvClient.authenticate(controllerUsername, controllerPassword);
            // console.log(authResponse);

            ti._writeLine('Authenticated with NeuVector controller')
        }
        catch (response) {
            tl.error(formatNeuVectorApiError(response))
            tl.setResult(tl.TaskResult.Failed, response.error.error);

            return;
        }

        // Verify license (only for local controller)
        if (localController) {
            
            let license: any;
            
            try {
                const licenseResponse = await nvClient.getLicense();

                license = licenseResponse.license;
            }
            catch (response) {
                tl.error(formatNeuVectorApiError(response))
                tl.setResult(tl.TaskResult.Failed, response.error.error);

                return;
            }

            if (!license) {
                // Apply license
                ti._writeLine(`Apply license to NeuVector controller`);

                try {
                    const licenseResponse = await nvClient.updateLicense(controllerLicense);

                    license = licenseResponse.license;

                    // Wait after license has been applied
                    await helper.delay(2000);
                }
                catch (response) {
                    tl.error(formatNeuVectorApiError(response))
                    tl.setResult(tl.TaskResult.Failed, response.error.error);

                    return;
                }
            }

            if (license) {
                ti._writeLine(`NeuVector controller license is valid until ${license.info.expire}`);
            }
        }

        // Start image scan
        ti._writeLine('Start image scan');

        let report: any;

        while (true) {
            try {
                let scanRepositoryResponse: any;

                if (registry) {
                    // Scan repository in external registry
                    scanRepositoryResponse = await nvClient.scanRepository(registryUrl, registryUsername, registryPassword, repository, tag, true);
                }
                else {
                    // Scan repository in local registry
                    scanRepositoryResponse = await nvClient.scanLocalRepository(repository, tag, true);
                }

                //console.log(scanRepositoryResponse);

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

        ti._writeLine('Completed image scan');

        ti._writeLine('Unauthenticate with NeuVector controller')

        try {
            const unauthenticateResponse = nvClient.unauthenticate();
        }
        catch (response) {
            tl.error(formatNeuVectorApiError(response))
            tl.setResult(tl.TaskResult.Failed, response.error.error);

            return;
        }

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
