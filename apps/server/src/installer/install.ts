import { DateTime, Effect, FileSystem } from 'effect';
import { randomUUID } from 'node:crypto';
import { probeOwner } from './service-health.ts';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import {
  serviceIsHealthy,
  servicePlan,
  type InstallerContext,
} from './context.ts';
import {
  backupDatabase,
  backupLocation,
  restoreDatabase,
} from './database-backup.ts';
import { AlreadyInstalledError } from './errors/already-installed-error.ts';
import { DataDirectoryBusyError } from './errors/data-directory-busy-error.ts';
import { InstallCleanupError } from './errors/install-cleanup-error.ts';
import { InstalledServiceUnhealthyError } from './errors/installed-service-unhealthy-error.ts';
import { UnitExistsError } from './errors/unit-exists-error.ts';
import { failureDetail } from './failure-detail.ts';
import { writeJsonFile } from './json-file.ts';
import { installRuntime } from './persistent-runtime.ts';
import {
  writePorcelainCommand,
  type CommandOutcome,
} from './porcelain-command.ts';
import { readInstalledRecord, type ServiceConfiguration } from './records.ts';
import { recoverInterruptedUpdate } from './recover-interrupted-update.ts';

export type InstallSettings = ServiceConfiguration;

export type InstallOutcome = {
  backup: string | undefined;
  lingerCommand: string | undefined;
  command: CommandOutcome;
};

const LINGER_COMMAND = 'sudo loginctl enable-linger "$(id -un)"';

export const install = Effect.fn('Installer.install')(function* (
  context: InstallerContext,
  settings: InstallSettings,
) {
  const fs = yield* FileSystem.FileSystem;
  const { paths, systemd, runner } = context;
  yield* recoverInterruptedUpdate(context);
  if ((yield* readInstalledRecord(paths.installed)) !== undefined)
    return yield* Effect.fail(new AlreadyInstalledError());
  if (yield* systemd.unitExists())
    return yield* Effect.fail(
      new UnitExistsError({ unitPath: systemd.unitPath }),
    );
  const socket = yield* probeOwner(context.ownerProbe, {
    socketPath: ownerSocketPath(settings.dataDirectory),
    timeoutMs: context.limits.owner.quickProbeTimeoutMs,
  });
  if (socket.kind !== 'absent')
    return yield* Effect.fail(
      new DataDirectoryBusyError({ state: socket.kind, phase: 'install' }),
    );
  const staging = `${paths.runtime}.next-${randomUUID()}`;
  const backup = backupLocation(
    paths.backups,
    DateTime.formatIso(
      DateTime.makeUnsafe(context.clock.currentTimeMillisUnsafe()),
    ),
    'preinstall',
    context.pathApi,
  );
  let backupComplete = false;
  let unitWritten = false;
  return yield* Effect.gen(function* () {
    yield* installRuntime(
      runner,
      context.nodeExecutable,
      context.packageRoot,
      staging,
      context.packageVersion,
    );
    yield* fs.makeDirectory(context.pathApi.dirname(paths.stdoutLog), {
      recursive: true,
      mode: 0o700,
    });
    for (const log of [paths.stdoutLog, paths.stderrLog]) {
      yield* fs.writeFileString(log, '', { flag: 'a', mode: 0o600 });
      yield* fs.chmod(log, 0o600);
    }
    yield* fs.rename(staging, paths.runtime);
    const configuration: ServiceConfiguration = {
      dataDirectory: settings.dataDirectory,
      port: settings.port,
    };
    yield* writeJsonFile(paths.configuration, configuration);
    yield* writeJsonFile(paths.installed, { version: context.packageVersion });
    yield* backupDatabase(settings.dataDirectory, backup);
    backupComplete = true;
    yield* systemd.write(servicePlan(context, configuration));
    unitWritten = true;
    const lingerEnabled = yield* systemd.enableLinger();
    yield* systemd.enableAndStart();
    if (!(yield* serviceIsHealthy(context, settings.dataDirectory)))
      return yield* Effect.fail(new InstalledServiceUnhealthyError());
    const command = yield* writePorcelainCommand(context);
    return {
      backup,
      lingerCommand: lingerEnabled ? undefined : LINGER_COMMAND,
      command,
    };
  }).pipe(
    Effect.catch(
      Effect.fn('Installer.cleanupInstall')(function* (error) {
        if (unitWritten) {
          yield* systemd.uninstall().pipe(
            Effect.mapError(
              (cleanupError) =>
                new InstallCleanupError({
                  detail: failureDetail(cleanupError),
                }),
            ),
          );
        }
        if (backupComplete)
          yield* restoreDatabase(settings.dataDirectory, backup);
        yield* fs.remove(paths.runtime, { recursive: true, force: true });
        yield* fs.remove(paths.installed, { force: true });
        yield* fs.remove(staging, { recursive: true, force: true });
        return yield* Effect.fail(error);
      }),
    ),
  );
});
