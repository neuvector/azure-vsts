import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

export function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
  }
}

export function saveBuildSummary(summary: string, name: string): string {
  const filePath = path.join(getNeuVectorStagingDirectory(), name);
  fs.writeFileSync(filePath, summary);
  return filePath;
}

export function getStagingDirectory(): string {
  const dir = tl.getVariable('Build.ArtifactStagingDirectory');

  if (dir === undefined) {
    throw new Error('Failed to determine predefined build variable Build.ArtifactStagingDirectory');
  }

  ensureDirExists(dir);

  return dir;
}

export function getNeuVectorStagingDirectory(): string {
  const dir = path.join(getStagingDirectory(), '.neuvector');

  ensureDirExists(dir);

  return dir;
}

export function uploadBuildSummary(summaryPath: string, title: string): void {
  tl.command(
    'task.addattachment',
    {
      type: 'Distributedtask.Core.Summary',
      name: title
    },
    summaryPath
  );
}