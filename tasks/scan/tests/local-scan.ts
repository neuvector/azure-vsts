import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'scan.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

let tempDir: string = path.join(__dirname, '_temp-local');
let localScanTestDir: string = path.join(__dirname, 'local-scan');

process.env['BUILD_ARTIFACTSTAGINGDIRECTORY'] = `${tempDir}`;

tmr.setInput('scanType', 'standalone');

tmr.setInput('nvContainerRegistry', 'NeuVector registry on Docker');
tmr.setInput('nvRepository', 'neuvector/scanner');
tmr.setInput('nvTag', 'latest');

tmr.setInput('repository', 'library/alpine');
tmr.setInput('tag', 'latest');

tmr.setInput('failOnHighSeverityThreshold', 'true');
tmr.setInput('highSeverityThreshold', '1');

tmr.setInput('failOnMediumSeverityThreshold', 'true');
tmr.setInput('mediumSeverityThreshold', '3');

tmr.setInput('failOnCveBlackList', 'false');
tmr.setInput('cveBlacklist', 'CVE-2019-1563\nCVE-2019-1567\n\nCVE-2019-1561');

tmr.setInput('reportJsonOutputPath', `${tempDir}/neuvector/report.json`);
tmr.setInput('reportMarkdownOutputPath', `${tempDir}/neuvector/report.md`);

tmr.run();