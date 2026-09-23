import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PorcelainService,
  type ServiceDependencies,
  type ServiceStatus,
} from '../bootstrap/service/service.ts';
import type { ServiceSettings } from './arguments.ts';

export type ServiceCommandDependencies = Partial<ServiceDependencies> & {
  homeDirectory: string;
  stdout: (message: string) => void;
};

export class ServiceCommandError extends Error {
  override readonly name = 'ServiceCommandError';
}

async function packageIdentity(moduleUrl: string) {
  const packageRoot = resolve(dirname(fileURLToPath(moduleUrl)), '../../..');
  const manifest = JSON.parse(
    await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
  ) as { name?: string; version?: string };
  if (
    manifest.name !== '@fabiofiorita/porcelain' ||
    typeof manifest.version !== 'string'
  )
    throw new Error(
      'Service management requires the packaged Porcelain CLI. Run it with `npx @fabiofiorita/porcelain@latest service ...`.',
    );
  return { packageRoot, packageVersion: manifest.version };
}

function formatStatus(status: ServiceStatus) {
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
) {
  try {
    await runServiceCommandInner(settings, dependencies, moduleUrl);
  } catch (error) {
    throw new ServiceCommandError(
      error instanceof Error ? error.message : 'Service management failed.',
    );
  }
}

async function runServiceCommandInner(
  settings: ServiceSettings,
  dependencies: ServiceCommandDependencies,
  moduleUrl: string,
) {
  const identity =
    dependencies.packageRoot && dependencies.packageVersion
      ? {
          packageRoot: dependencies.packageRoot,
          packageVersion: dependencies.packageVersion,
        }
      : await packageIdentity(moduleUrl);
  const service = new PorcelainService(dependencies.homeDirectory, {
    ...identity,
    ...(dependencies.platform ? { platform: dependencies.platform } : {}),
    ...(dependencies.uid === undefined ? {} : { uid: dependencies.uid }),
    ...(dependencies.runner ? { runner: dependencies.runner } : {}),
    ...(dependencies.nodeExecutable
      ? { nodeExecutable: dependencies.nodeExecutable }
      : {}),
    ...(dependencies.healthCheck
      ? { healthCheck: dependencies.healthCheck }
      : {}),
    ...(dependencies.environmentPath
      ? { environmentPath: dependencies.environmentPath }
      : {}),
  });
  if (settings.action === 'status') {
    dependencies.stdout(`${formatStatus(await service.status())}\n`);
    return;
  }
  if (settings.action === 'install') {
    const result = await service.install(settings);
    dependencies.stdout(
      `Installed Porcelain ${identity.packageVersion} as a user service.\n`,
    );
    if (result.backup)
      dependencies.stdout(`Database backup: ${result.backup}\n`);
    if (result.lingerCommand)
      dependencies.stdout(
        `Lingering needs administrator permission. Run exactly:\n${result.lingerCommand}\n`,
      );
    return;
  }
  if (settings.action === 'update') {
    const result = await service.update(settings.allowDowngrade);
    dependencies.stdout(
      `Updated the Porcelain service to ${identity.packageVersion}.\nDatabase backup: ${result.backup ?? 'not needed'}\n`,
    );
    return;
  }
  dependencies.stdout(
    (await service.uninstall())
      ? 'Uninstalled the Porcelain service. User data was retained.\n'
      : 'Porcelain service is not installed. User data was retained.\n',
  );
}
