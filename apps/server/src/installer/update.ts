import { rename, rm } from 'node:fs/promises';
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

async function restartPrevious(
  context: InstallerContext,
  dataDirectory: string,
): Promise<void> {
  await context.systemd.start();
  if (!(await serviceIsHealthy(context, dataDirectory)))
    throw new PreviousServiceUnhealthyError();
}

export async function update(
  context: InstallerContext,
  allowDowngrade: boolean,
): Promise<UpdateOutcome> {
  const { paths } = context;
  let progress = { from: '', target: context.packageVersion };
  try {
    await recoverInterruptedUpdate(context);
    const installed = await readInstalledRecord(paths.installed);
    if (installed === undefined) throw new NotInstalledError();
    progress = { ...progress, from: installed.version };
    if (
      !allowDowngrade &&
      isDowngrade(context.packageVersion, installed.version)
    )
      throw new ServiceDowngradeError(
        installed.version,
        context.packageVersion,
      );
    const configuration = await readServiceConfiguration(paths.configuration);
    await writeJsonFile(paths.updateRecord, {
      ...progress,
      stage: 'installing',
    });
    const outcome = await replaceRuntime(
      context,
      configuration,
      installed,
      () =>
        writeJsonFile(paths.updateRecord, { ...progress, stage: 'restarting' }),
    );
    await writeJsonFile(paths.updateRecord, { ...progress, stage: 'updated' });
    return outcome;
  } catch (error) {
    await writeJsonFile(paths.updateRecord, {
      ...progress,
      stage: 'failed',
      reason: failureDetail(error),
    });
    throw error;
  }
}

async function replaceRuntime(
  context: InstallerContext,
  configuration: ServiceConfiguration,
  installed: InstalledRecord,
  restarting: () => Promise<void>,
): Promise<UpdateOutcome> {
  const { paths, systemd, runner } = context;
  const staging = paths.nextRuntime;
  const previous = paths.previousRuntime;
  const backup = backupLocation(
    paths.backups,
    context.clock.now(),
    installed.version,
  );
  await installRuntime(
    runner,
    context.nodeExecutable,
    context.packageRoot,
    staging,
    context.packageVersion,
  );
  let stopped = false;
  let replaced = false;
  try {
    await restarting();
    await systemd.stop();
    stopped = true;
    const socket = await context.ownerProbe.probe({
      socketPath: ownerSocketPath(configuration.dataDirectory),
      timeoutMs: context.limits.owner.quickProbeTimeoutMs,
    });
    if (socket.kind !== 'absent')
      throw new DataDirectoryBusyError(socket.kind, 'update');
    await backupDatabase(configuration.dataDirectory, backup);
    await writeJsonFile(paths.updateJournal, {
      installed,
      backup,
      target: context.packageVersion,
    });
    await rename(paths.runtime, previous);
    replaced = true;
    await rename(staging, paths.runtime);
    await writeJsonFile(paths.installed, { version: context.packageVersion });
    await systemd.write(servicePlan(context, configuration));
    await systemd.enableAndStart();
    if (!(await serviceIsHealthy(context, configuration.dataDirectory)))
      throw new UpdatedServiceUnhealthyError();
    await writeJsonFile(paths.updateJournal, {
      installed,
      backup,
      target: context.packageVersion,
      healthy: true,
    });
  } catch (error) {
    let hint: string | undefined;
    if (await exists(paths.updateJournal)) {
      try {
        hint = (await recoverInterruptedUpdate(context)).localNetworkHint;
      } catch (recoveryError) {
        throw new UpdateRecoveryError(failureDetail(recoveryError));
      }
    } else if (stopped) {
      try {
        await restartPrevious(context, configuration.dataDirectory);
      } catch (recoveryError) {
        throw new UpdateRestartError(failureDetail(recoveryError));
      }
    }
    const recovery = replaced
      ? 'the previous runtime and database were restored'
      : stopped
        ? 'the previous runtime was restarted before replacement'
        : 'the installed service was left unchanged';
    throw new UpdateFailedError(recovery, failureDetail(error), hint);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  await rm(previous, { recursive: true, force: true });
  await rm(paths.updateJournal, { force: true });
  return { backup, localNetworkHint: localNetworkHint(configuration.host) };
}
