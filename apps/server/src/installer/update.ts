import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import {
  serviceIsHealthy,
  servicePlan,
  type InstallerContext,
} from './context.ts';
import { backupDatabase } from './database-backup.ts';
import { DataDirectoryBusyError } from './errors/data-directory-busy-error.ts';
import { NotInstalledError } from './errors/not-installed-error.ts';
import { ServiceDowngradeError } from './errors/service-downgrade-error.ts';
import { UpdatedServiceUnhealthyError } from './errors/updated-service-unhealthy-error.ts';
import { UpdateFailedError } from './errors/update-failed-error.ts';
import { UpdateRecoveryError } from './errors/update-recovery-error.ts';
import { UpdateRestartError } from './errors/update-restart-error.ts';
import { exists, writeJsonFile } from './json-file.ts';
import { installRuntime } from './persistent-runtime.ts';
import { readInstalledRecord, readServiceConfiguration } from './records.ts';
import { recoverInterruptedUpdate } from './recover-interrupted-update.ts';
import { isDowngrade } from './version-policy.ts';

export type UpdateOutcome = { backup: string };

function failureDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function restartPrevious(
  context: InstallerContext,
  dataDirectory: string,
): Promise<void> {
  await context.systemd.start();
  if (!(await serviceIsHealthy(context, dataDirectory)))
    throw new UpdatedServiceUnhealthyError();
}

export async function update(
  context: InstallerContext,
  allowDowngrade: boolean,
): Promise<UpdateOutcome> {
  const { paths, systemd, runner } = context;
  await recoverInterruptedUpdate(context);
  const installed = await readInstalledRecord(paths.installed);
  if (installed === undefined) throw new NotInstalledError();
  if (!allowDowngrade && isDowngrade(context.packageVersion, installed.version))
    throw new ServiceDowngradeError(installed.version, context.packageVersion);
  const configuration = await readServiceConfiguration(paths.configuration);
  const staging = paths.nextRuntime;
  const previous = paths.previousRuntime;
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const backup = join(
    paths.backups,
    `${stamp}-${installed.version}-${randomUUID()}`,
  );
  await installRuntime(
    runner,
    context.packageRoot,
    staging,
    context.packageVersion,
  );
  let stopped = false;
  let replaced = false;
  try {
    await systemd.stop();
    stopped = true;
    const socket = await context.probe(
      ownerSocketPath(configuration.dataDirectory),
      500,
    );
    if (socket.kind !== 'absent')
      throw new DataDirectoryBusyError(socket.kind, 'update');
    await backupDatabase(configuration.dataDirectory, backup);
    await writeJsonFile(paths.updateJournal, { installed, backup });
    await rename(paths.runtime, previous);
    replaced = true;
    await rename(staging, paths.runtime);
    await writeJsonFile(paths.installed, { version: context.packageVersion });
    await systemd.write(servicePlan(context, configuration));
    await systemd.enableAndStart();
    if (!(await serviceIsHealthy(context, configuration.dataDirectory)))
      throw new UpdatedServiceUnhealthyError();
    await rm(paths.updateJournal, { force: true });
    await rm(previous, { recursive: true, force: true });
    return { backup };
  } catch (error) {
    if (await exists(paths.updateJournal)) {
      try {
        await recoverInterruptedUpdate(context);
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
    throw new UpdateFailedError(recovery, failureDetail(error));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
