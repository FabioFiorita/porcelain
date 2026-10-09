import type { Path } from 'effect';

export type ServicePaths = {
  root: string;
  runtime: string;
  nextRuntime: string;
  previousRuntime: string;
  updateJournal: string;
  updateRecord: string;
  updater: string;
  installed: string;
  configuration: string;
  backups: string;
  stdoutLog: string;
  stderrLog: string;
  command: string;
};

export function servicePaths(
  homeDirectory: string,
  pathApi: Path.Path,
): ServicePaths {
  const root = pathApi.join(homeDirectory, '.local/share/porcelain/service');
  return {
    root,
    runtime: pathApi.join(root, 'runtime'),
    nextRuntime: pathApi.join(root, 'runtime.next'),
    previousRuntime: pathApi.join(root, 'runtime.previous'),
    updateJournal: pathApi.join(root, 'update.json'),
    updateRecord: pathApi.join(root, 'update-record.json'),
    updater: pathApi.join(root, 'updater'),
    installed: pathApi.join(root, 'installed.json'),
    configuration: pathApi.join(root, 'config.json'),
    backups: pathApi.join(root, 'database-backups'),
    stdoutLog: pathApi.join(root, 'logs/stdout.log'),
    stderrLog: pathApi.join(root, 'logs/stderr.log'),
    command: pathApi.join(homeDirectory, '.local/bin/porcelain'),
  };
}
