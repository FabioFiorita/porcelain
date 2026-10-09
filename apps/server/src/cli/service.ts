import { Effect, Layer, type Clock } from 'effect';
import { ServiceCommandError } from './errors/service-command-error.ts';
import type { Limits } from '../config/limits.ts';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isInstallerError,
  Installer,
  InstallerOptions,
  readPackageIdentity,
  type CommandOutcome,
  type ServiceStatus,
} from '../installer/index.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import type { ServiceSettings } from './settings.ts';

type ServiceCommandDependencies = {
  homeDirectory: string;
  searchPath: string;
  clock: Clock.Clock;
  ownerProbe: OwnerProbe;
  limits: Limits;
  stdout: (message: string) => void;
};

export function cliPackageRoot(moduleUrl: string = import.meta.url): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), '../../..');
}

export function isServiceFailure(error: unknown): boolean {
  return isInstallerError(error) || error instanceof ServiceCommandError;
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

function formatCommand(command: CommandOutcome): string {
  if (command.kind === 'foreign')
    return `Left ${command.path} unchanged because Porcelain did not write it, so the porcelain command was not added.\n`;
  const directory = dirname(command.path);
  return command.onSearchPath
    ? `The porcelain command is at ${command.path}.\n`
    : `The porcelain command is at ${command.path}; add ${directory} to PATH to use it: export PATH="${directory}:$PATH"\n`;
}

export const runServiceCommand = Effect.fn('runServiceCommand')(
  function* (
    settings: ServiceSettings,
    dependencies: ServiceCommandDependencies,
    moduleUrl: string = import.meta.url,
  ) {
    const identity = yield* readPackageIdentity(cliPackageRoot(moduleUrl));
    const options = {
      homeDirectory: dependencies.homeDirectory,
      packageRoot: identity.packageRoot,
      packageVersion: identity.packageVersion,
      searchPath: dependencies.searchPath,
      ownerProbe: dependencies.ownerProbe,
      clock: dependencies.clock,
      limits: dependencies.limits,
    };
    return yield* Effect.gen(function* () {
      const installer = yield* Installer;
      if (settings.action === 'status') {
        const outcome = yield* installer.execute({ action: 'status' });
        if (outcome.action === 'status')
          dependencies.stdout(`${formatStatus(outcome.status)}\n`);
        return;
      }
      if (settings.action === 'install') {
        const outcome = yield* installer.execute({
          action: 'install',
          settings,
        });
        if (outcome.action !== 'install') return;
        const result = outcome.result;
        dependencies.stdout(
          `Installed Porcelain ${identity.packageVersion} as a user service. To share it on the local network, run: porcelain share lan on\n`,
        );
        dependencies.stdout(formatCommand(result.command));
        if (result.backup !== undefined)
          dependencies.stdout(`Database backup: ${result.backup}\n`);
        if (result.lingerCommand !== undefined)
          dependencies.stdout(
            `Lingering needs administrator permission. Run exactly:\n${result.lingerCommand}\n`,
          );
        return;
      }
      if (settings.action === 'update') {
        const outcome = yield* installer.execute({
          action: 'update',
          allowDowngrade: settings.allowDowngrade,
        });
        if (outcome.action !== 'update') return;
        const result = outcome.result;
        dependencies.stdout(
          `Updated the Porcelain service to ${identity.packageVersion}.\nDatabase backup: ${result.backup}\n`,
        );
        dependencies.stdout(formatCommand(result.command));
        return;
      }
      if (settings.action === 'recover') {
        const outcome = yield* installer.execute({ action: 'recover' });
        if (outcome.action !== 'recover') return;
        const recovery = outcome.result;
        dependencies.stdout(
          recovery.recovered
            ? 'Recovered the Porcelain service.\n'
            : 'The Porcelain service needed no recovery.\n',
        );
        return;
      }
      const outcome = yield* installer.execute({ action: 'uninstall' });
      dependencies.stdout(
        outcome.action === 'uninstall' && outcome.removed
          ? 'Uninstalled the Porcelain service. User data was retained.\n'
          : 'Porcelain service is not installed. User data was retained.\n',
      );
    }).pipe(
      Effect.provide(
        Installer.layer.pipe(
          Layer.provide(Layer.succeed(InstallerOptions, options)),
        ),
      ),
    );
  },
  Effect.mapError((error) =>
    isInstallerError(error) ? error : new ServiceCommandError(error.message),
  ),
);
