import { DateTime, Effect, FileSystem } from 'effect';
import { probeOwner } from './service-health.ts';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import {
  serviceIsHealthy,
  servicePlan,
  type InstallerContext,
} from './context.ts';
import { backupDatabase, backupLocation } from './database-backup.ts';
import { DataDirectoryBusyError } from './errors/data-directory-busy-error.ts';
import { NotInstalledError } from './errors/not-installed-error.ts';
import { PreviousServiceUnhealthyError } from './errors/previous-service-unhealthy-error.ts';
import { ServiceDowngradeError } from './errors/service-downgrade-error.ts';
import { UpdatedServiceUnhealthyError } from './errors/updated-service-unhealthy-error.ts';
import { UpdateFailedError } from './errors/update-failed-error.ts';
import { UpdateRecoveryError } from './errors/update-recovery-error.ts';
import { UpdateRestartError } from './errors/update-restart-error.ts';
import { failureDetail } from './failure-detail.ts';
import { exists, writeJsonFile } from './json-file.ts';
import { installRuntime } from './persistent-runtime.ts';
import {
  readInstalledRecord,
  readServiceConfiguration,
  type InstalledRecord,
  type ServiceConfiguration,
} from './records.ts';
import { recoverInterruptedUpdate } from './recover-interrupted-update.ts';
import { localNetworkHint } from './share-hint.ts';
import { isDowngrade } from './version-policy.ts';

export type UpdateOutcome = {
  backup: string;
  localNetworkHint: string | undefined;
};

const restartPrevious = Effect.fn('Installer.restartPrevious')(function* (
  context: InstallerContext,
  dataDirectory: string,
) {
  yield* context.systemd.start();
  if (!(yield* serviceIsHealthy(context, dataDirectory)))
    return yield* Effect.fail(new PreviousServiceUnhealthyError());
});

export const update = Effect.fn('Installer.update')(function* (
  context: InstallerContext,
  allowDowngrade: boolean,
) {
  const { paths } = context;
  let progress = { from: '', target: context.packageVersion };
  return yield* Effect.gen(function* () {
    yield* recoverInterruptedUpdate(context);
    const installed = yield* readInstalledRecord(paths.installed);
    if (installed === undefined)
      return yield* Effect.fail(new NotInstalledError());
    progress = { ...progress, from: installed.version };
    if (
      !allowDowngrade &&
      (yield* isDowngrade(context.packageVersion, installed.version))
    )
      return yield* Effect.fail(
        new ServiceDowngradeError({
          installed: installed.version,
          candidate: context.packageVersion,
        }),
      );
    const configuration = yield* readServiceConfiguration(paths.configuration);
    yield* writeJsonFile(paths.updateRecord, {
      ...progress,
      stage: 'installing',
    });
    const outcome = yield* replaceRuntime(
      context,
      configuration,
      installed,
      () =>
        writeJsonFile(paths.updateRecord, { ...progress, stage: 'restarting' }),
    );
    yield* writeJsonFile(paths.updateRecord, { ...progress, stage: 'updated' });
    return outcome;
  }).pipe(
    Effect.catch(
      Effect.fn('Installer.recordFailedUpdate')(function* (error) {
        yield* writeJsonFile(paths.updateRecord, {
          ...progress,
          stage: 'failed',
          reason: failureDetail(error),
        });
        return yield* Effect.fail(error);
      }),
    ),
  );
});

const replaceRuntime = Effect.fn('Installer.replaceRuntime')(function* (
  context: InstallerContext,
  configuration: ServiceConfiguration,
  installed: InstalledRecord,
  restarting: () => ReturnType<typeof writeJsonFile>,
) {
  const fs = yield* FileSystem.FileSystem;
  const { paths, systemd, runner } = context;
  const staging = paths.nextRuntime;
  const previous = paths.previousRuntime;
  const backup = backupLocation(
    paths.backups,
    DateTime.formatIso(
      DateTime.makeUnsafe(context.clock.currentTimeMillisUnsafe()),
    ),
    installed.version,
    context.pathApi,
  );
  yield* installRuntime(
    runner,
    context.nodeExecutable,
    context.packageRoot,
    staging,
    context.packageVersion,
  );
  let stopped = false;
  let replaced = false;
  yield* Effect.gen(function* () {
    yield* restarting();
    yield* systemd.stop();
    stopped = true;
    const socket = yield* probeOwner(context.ownerProbe, {
      socketPath: ownerSocketPath(configuration.dataDirectory),
      timeoutMs: context.limits.owner.quickProbeTimeoutMs,
    });
    if (socket.kind !== 'absent')
      return yield* Effect.fail(
        new DataDirectoryBusyError({ state: socket.kind, phase: 'update' }),
      );
    yield* backupDatabase(configuration.dataDirectory, backup);
    yield* writeJsonFile(paths.updateJournal, {
      installed,
      backup,
      target: context.packageVersion,
    });
    yield* fs.rename(paths.runtime, previous);
    replaced = true;
    yield* fs.rename(staging, paths.runtime);
    yield* writeJsonFile(paths.installed, { version: context.packageVersion });
    yield* systemd.write(servicePlan(context, configuration));
    yield* systemd.enableAndStart();
    if (!(yield* serviceIsHealthy(context, configuration.dataDirectory)))
      return yield* Effect.fail(new UpdatedServiceUnhealthyError());
    yield* writeJsonFile(paths.updateJournal, {
      installed,
      backup,
      target: context.packageVersion,
      healthy: true,
    });
  }).pipe(
    Effect.catch(
      Effect.fn('Installer.rollbackUpdate')(function* (error) {
        let hint: string | undefined;
        if (yield* exists(paths.updateJournal)) {
          const recovered = yield* recoverInterruptedUpdate(context).pipe(
            Effect.mapError(
              (recoveryError) =>
                new UpdateRecoveryError({
                  detail: failureDetail(recoveryError),
                }),
            ),
          );
          hint = recovered.localNetworkHint;
        } else if (stopped) {
          yield* restartPrevious(context, configuration.dataDirectory).pipe(
            Effect.mapError(
              (recoveryError) =>
                new UpdateRestartError({
                  detail: failureDetail(recoveryError),
                }),
            ),
          );
        }
        const recovery = replaced
          ? 'the previous runtime and database were restored'
          : stopped
            ? 'the previous runtime was restarted before replacement'
            : 'the installed service was left unchanged';
        return yield* Effect.fail(
          new UpdateFailedError({
            recovery: recovery,
            detail: failureDetail(error),
            hint: hint,
          }),
        );
      }),
    ),
    Effect.ensuring(
      fs.remove(staging, { recursive: true, force: true }).pipe(Effect.orDie),
    ),
  );
  yield* fs.remove(previous, { recursive: true, force: true });
  yield* fs.remove(paths.updateJournal, { force: true });
  return { backup, localNetworkHint: localNetworkHint(configuration.host) };
});
