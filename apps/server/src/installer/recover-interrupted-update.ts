import { Effect, FileSystem } from 'effect';
import {
  serviceIsHealthy,
  servicePlan,
  type InstallerContext,
} from './context.ts';
import { restoreDatabase } from './database-backup.ts';
import { InterruptedUpdateUnrecoverableError } from './errors/interrupted-update-unrecoverable-error.ts';
import { RestoredServiceUnhealthyError } from './errors/restored-service-unhealthy-error.ts';
import { exists, writeJsonFile } from './json-file.ts';
import { readServiceConfiguration, readUpdateJournal } from './records.ts';
import { recoveryPlan } from './recovery-plan.ts';
import { localNetworkHint } from './share-hint.ts';

export type RecoveryOutcome = {
  recovered: boolean;
  localNetworkHint: string | undefined;
};

const NOTHING_RECOVERED: RecoveryOutcome = {
  recovered: false,
  localNetworkHint: undefined,
};

export const recoverInterruptedUpdate = Effect.fn(
  'Installer.recoverInterruptedUpdate',
)(function* (context: InstallerContext) {
  const fs = yield* FileSystem.FileSystem;
  const { paths, systemd } = context;
  const journal = yield* readUpdateJournal(paths.updateJournal);
  const plan = recoveryPlan({
    journal,
    runtimeExists: yield* exists(paths.runtime),
    previousExists: yield* exists(paths.previousRuntime),
  });
  if (plan === 'nothing') return NOTHING_RECOVERED;
  if (plan === 'discard-previous') {
    yield* fs.remove(paths.previousRuntime, { recursive: true, force: true });
    return NOTHING_RECOVERED;
  }
  if (plan === 'unrecoverable' || journal === undefined)
    return yield* Effect.fail(new InterruptedUpdateUnrecoverableError());
  const configuration = yield* readServiceConfiguration(paths.configuration);
  const recovered = {
    recovered: true,
    localNetworkHint: localNetworkHint(configuration.host),
  };
  const progress = {
    from: journal.installed.version,
    target: journal.target ?? '',
  };
  if (plan === 'finish-update') {
    yield* fs.remove(paths.previousRuntime, { recursive: true, force: true });
    yield* fs.remove(paths.nextRuntime, { recursive: true, force: true });
    yield* fs.remove(paths.updateJournal, { force: true });
    yield* writeJsonFile(paths.updateRecord, { ...progress, stage: 'updated' });
    if (!(yield* systemd.probe()).running) yield* systemd.start();
    return recovered;
  }
  if ((yield* systemd.probe()).running) yield* systemd.stop();
  if (plan === 'restore-previous') {
    yield* fs.remove(paths.runtime, { recursive: true, force: true });
    yield* fs.rename(paths.previousRuntime, paths.runtime);
  }
  yield* restoreDatabase(configuration.dataDirectory, journal.backup);
  yield* writeJsonFile(paths.installed, journal.installed);
  yield* systemd.write(servicePlan(context, configuration));
  yield* systemd.start();
  if (!(yield* serviceIsHealthy(context, configuration.dataDirectory)))
    return yield* Effect.fail(new RestoredServiceUnhealthyError());
  yield* fs.remove(paths.nextRuntime, { recursive: true, force: true });
  yield* fs.remove(paths.updateJournal, { force: true });
  yield* writeJsonFile(paths.updateRecord, {
    ...progress,
    stage: 'failed',
    reason: `The update was interrupted, so Porcelain went back to ${journal.installed.version} and the database it had before the update.`,
  });
  return recovered;
});

export const recoverService = Effect.fn('Installer.recoverService')(function* (
  context: InstallerContext,
) {
  const interrupted = yield* recoverInterruptedUpdate(context);
  if (interrupted.recovered) return interrupted;
  if (!(yield* exists(context.paths.installed))) return NOTHING_RECOVERED;
  if ((yield* context.systemd.probe()).running) return NOTHING_RECOVERED;
  yield* context.systemd.start();
  return { recovered: true, localNetworkHint: undefined };
});
