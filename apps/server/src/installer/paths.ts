import { join } from 'node:path';

export type ServicePaths = {
  root: string;
  runtime: string;
  nextRuntime: string;
  previousRuntime: string;
  updateJournal: string;
  installed: string;
  configuration: string;
  backups: string;
  stdoutLog: string;
  stderrLog: string;
};

export function servicePaths(homeDirectory: string): ServicePaths {
  const root = join(homeDirectory, '.local/share/porcelain/service');
  return {
    root,
    runtime: join(root, 'runtime'),
    nextRuntime: join(root, 'runtime.next'),
    previousRuntime: join(root, 'runtime.previous'),
    updateJournal: join(root, 'update.json'),
    installed: join(root, 'installed.json'),
    configuration: join(root, 'config.json'),
    backups: join(root, 'database-backups'),
    stdoutLog: join(root, 'logs/stdout.log'),
    stderrLog: join(root, 'logs/stderr.log'),
  };
}
