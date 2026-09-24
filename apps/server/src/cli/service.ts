import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InstallerError,
  openInstaller,
  readPackageIdentity,
  type ServiceStatus,
} from '../installer/index.ts';
import type { Clock } from '../ports/clock.ts';
import type { ServiceSettings } from './arguments.ts';
import { probeOwnerSocket } from './owner-client.ts';

export type ServiceCommandDependencies = {
  homeDirectory: string;
  searchPath: string;
  clock: Clock;
  stdout: (message: string) => void;
};

export class ServiceCommandError extends Error {
  override readonly name = 'ServiceCommandError';
  constructor(detail: string) {
    super(`Service management failed: ${detail}`);
  }
}

export function isServiceFailure(error: unknown): boolean {
  return (
    error instanceof InstallerError || error instanceof ServiceCommandError
  );
}

function formatStatus(status: ServiceStatus): string {
  return [
    'Porcelain service',
    `  Installed: ${status.installed ? `yes (${status.version})` : 'no'}`,
    `  Enabled: ${status.enabled ? 'yes' : 'no'}`,
    `  Running: ${status.running ? 'yes' : 'no'}`,
    `  Linger: ${status.linger}`,
    `  Unit: ${status.unitPath}`,
    `  Standard output: ${status.stdoutLog}`,
    `  Standard error: ${status.stderrLog}`,
  ].join('\n');
}

export async function runServiceCommand(
  settings: ServiceSettings,
  dependencies: ServiceCommandDependencies,
  moduleUrl: string = import.meta.url,
): Promise<void> {
  try {
    await runService(settings, dependencies, moduleUrl);
  } catch (error) {
    if (error instanceof InstallerError) throw error;
    throw new ServiceCommandError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function runService(
  settings: ServiceSettings,
  dependencies: ServiceCommandDependencies,
  moduleUrl: string,
): Promise<void> {
  const identity = await readPackageIdentity(
    resolve(dirname(fileURLToPath(moduleUrl)), '../../..'),
  );
  const installer = openInstaller({
    homeDirectory: dependencies.homeDirectory,
    packageRoot: identity.packageRoot,
    packageVersion: identity.packageVersion,
    searchPath: dependencies.searchPath,
    probe: probeOwnerSocket,
    clock: dependencies.clock,
  });
  if (settings.action === 'status') {
    dependencies.stdout(`${formatStatus(await installer.status())}\n`);
    return;
  }
  if (settings.action === 'install') {
    const result = await installer.install(settings);
    dependencies.stdout(
      `Installed Porcelain ${identity.packageVersion} as a user service.\n`,
    );
    if (result.backup !== undefined)
      dependencies.stdout(`Database backup: ${result.backup}\n`);
    if ('lingerCommand' in result && result.lingerCommand !== undefined)
      dependencies.stdout(
        `Lingering needs administrator permission. Run exactly:\n${result.lingerCommand}\n`,
      );
    return;
  }
  if (settings.action === 'update') {
    const result = await installer.update(settings.allowDowngrade);
    dependencies.stdout(
      `Updated the Porcelain service to ${identity.packageVersion}.\nDatabase backup: ${result.backup}\n`,
    );
    return;
  }
  dependencies.stdout(
    (await installer.uninstall())
      ? 'Uninstalled the Porcelain service. User data was retained.\n'
      : 'Porcelain service is not installed. User data was retained.\n',
  );
}
