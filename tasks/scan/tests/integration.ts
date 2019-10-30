import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'scan.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

let tempDir: string = path.join(__dirname, '_temp');

process.env['BUILD_ARTIFACTSTAGINGDIRECTORY'] = `${tempDir}`;

tmr.setInput('neuvectorController', 'testNeuvectorController');

// TODO lookup variables form environment
process.env['ENDPOINT_URL_testNeuvectorController'] = 'https://20.42.33.28:10443';
process.env['ENDPOINT_AUTH_SCHEME_testNeuvectorController'] = 'usernamepassword';
process.env['ENDPOINT_AUTH_PARAMETER_testNeuvectorController_USERNAME'] = '';
process.env['ENDPOINT_AUTH_PARAMETER_testNeuvectorController_PASSWORD'] = '';
process.env['ENDPOINT_DATA_testNeuvectorController_ACCEPTUNTRUSTEDCERTS'] = 'true';

tmr.setInput('containerRegistry', 'testContainerRegistry');

// Public Dockerhub endpoint
process.env["ENDPOINT_AUTH_testContainerRegistry"] = "{\"parameters\":{\"username\":\"\", \"password\":\"\", \"email\":\"testuser@neuvector.local\",\"registry\":\"https://registry.hub.docker.com/\"},\"scheme\":\"UsernamePassword\"}";

tmr.setInput('repository', 'library/alpine');
tmr.setInput('tag', 'latest');

tmr.setInput('failOnHighSeverityThreshold', 'true');
tmr.setInput('highSeverityThreshold', '1');

tmr.setInput('failOnMediumSeverityThreshold', 'true');
tmr.setInput('mediumSeverityThreshold', '3');

//tmr.setInput('failOnCveBlackList', 'true');
tmr.setInput('failOnCveBlackList', 'false');
tmr.setInput('cveBlacklist', 'CVE-2019-1563\nCVE-2019-1567\n\nCVE-2019-1561');

tmr.setInput('reportJsonOutputPath', `${tempDir}/neuvector/report.json`);
tmr.setInput('reportMarkdownOutputPath', `${tempDir}/neuvector/report.md`);

tmr.run();