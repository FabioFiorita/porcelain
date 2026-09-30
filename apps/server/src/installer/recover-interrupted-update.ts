import { rename, rm } from 'node:fs/promises';
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

export async function recoverInterruptedUpdate(
  context: InstallerContext,
): Promise<RecoveryOutcome> {
  const { paths, systemd } = context;
  const journal = await readUpdateJournal(paths.updateJournal);
  const plan = recoveryPlan({
    journal,
    runtimeExists: await exists(paths.runtime),
    previousExists: await exists(paths.previousRuntime),
  });
  if (plan === 'nothing') return NOTHING_RECOVERED;
  if (plan === 'discard-previous') {
    await rm(paths.previousRuntime, { recursive: true, force: true });
    return NOTHING_RECOVERED;
  }
  if (plan === 'unrecoverable' || journal === undefined)
    throw new InterruptedUpdateUnrecoverableError();
  const configuration = await readServiceConfiguration(paths.configuration);
  const recovered = {
    recovered: true,
    localNetworkHint: localNetworkHint(configuration.host),
  };
  const progress = {
    from: journal.installed.version,
    target: journal.target ?? '',
  };
  if (plan === 'finish-update') {
    await rm(paths.previousRuntime, { recursive: true, force: true });
    await rm(paths.nextRuntime, { recursive: true, force: true });
    await rm(paths.updateJournal, { force: true });
    await writeJsonFile(paths.updateRecord, { ...progress, stage: 'updated' });
    if (!(await systemd.probe()).running) await systemd.start();
    return recovered;
  }
  if ((await systemd.probe()).running) await systemd.stop();
  if (plan === 'restore-previous') {
    await rm(paths.runtime, { recursive: true, force: true });
    await rename(paths.previousRuntime, paths.runtime);
  }
  await restoreDatabase(configuration.dataDirectory, journal.backup);
  await writeJsonFile(paths.installed, journal.installed);
  await systemd.write(servicePlan(context, configuration));
  await systemd.start();
  if (!(await serviceIsHealthy(context, configuration.dataDirectory)))
    throw new RestoredServiceUnhealthyError();
  await rm(paths.nextRuntime, { recursive: true, force: true });
  await rm(paths.updateJournal, { force: true });
  await writeJsonFile(paths.updateRecord, {
    ...progress,
    stage: 'failed',
    reason: `The update was interrupted, so Porcelain went back to ${journal.installed.version} and the database it had before the update.`,
  });
  return recovered;
}

export async function recoverService(
  context: InstallerContext,
): Promise<RecoveryOutcome> {
  const interrupted = await recoverInterruptedUpdate(context);
  if (interrupted.recovered) return interrupted;
  if (!(await exists(context.paths.installed))) return NOTHING_RECOVERED;
  if ((await context.systemd.probe()).running) return NOTHING_RECOVERED;
  await context.systemd.start();
  return { recovered: true, localNetworkHint: undefined };
}
