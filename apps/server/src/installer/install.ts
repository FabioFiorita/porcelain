import { randomUUID } from 'node:crypto';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { LIMITS } from '../config/limits.ts';
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
import { readInstalledRecord, type ServiceConfiguration } from './records.ts';
import { recoverInterruptedUpdate } from './recover-interrupted-update.ts';

export type InstallSettings = ServiceConfiguration;

export type InstallOutcome = {
  backup: string | undefined;
  lingerCommand: string | undefined;
};

const LINGER_COMMAND = 'sudo loginctl enable-linger "$(id -un)"';

export async function install(
  context: InstallerContext,
  settings: InstallSettings,
): Promise<InstallOutcome> {
  const { paths, systemd, runner } = context;
  await recoverInterruptedUpdate(context);
  if ((await readInstalledRecord(paths.installed)) !== undefined)
    throw new AlreadyInstalledError();
  if (await systemd.unitExists()) throw new UnitExistsError(systemd.unitPath);
  const socket = await context.ownerProbe.probe({
    socketPath: ownerSocketPath(settings.dataDirectory),
    timeoutMs: LIMITS.owner.quickProbeTimeoutMs,
  });
  if (socket.kind !== 'absent')
    throw new DataDirectoryBusyError(socket.kind, 'install');
  const staging = `${paths.runtime}.next-${randomUUID()}`;
  const backup = backupLocation(
    paths.backups,
    context.clock.now(),
    'preinstall',
  );
  let backupComplete = false;
  let unitWritten = false;
  try {
    await installRuntime(
      runner,
      context.packageRoot,
      staging,
      context.packageVersion,
    );
    await mkdir(dirname(paths.stdoutLog), { recursive: true, mode: 0o700 });
    for (const log of [paths.stdoutLog, paths.stderrLog]) {
      await writeFile(log, '', { flag: 'a', mode: 0o600 });
      await chmod(log, 0o600);
    }
    await rename(staging, paths.runtime);
    const configuration: ServiceConfiguration = {
      dataDirectory: settings.dataDirectory,
      host: settings.host,
      port: settings.port,
      allowedHosts: settings.allowedHosts,
    };
    await writeJsonFile(paths.configuration, configuration);
    await writeJsonFile(paths.installed, { version: context.packageVersion });
    await backupDatabase(settings.dataDirectory, backup);
    backupComplete = true;
    await systemd.write(servicePlan(context, configuration));
    unitWritten = true;
    const lingerEnabled = await systemd.enableLinger();
    await systemd.enableAndStart();
    if (!(await serviceIsHealthy(context, settings.dataDirectory)))
      throw new InstalledServiceUnhealthyError();
    return {
      backup,
      lingerCommand: lingerEnabled ? undefined : LINGER_COMMAND,
    };
  } catch (error) {
    if (unitWritten) {
      try {
        await systemd.uninstall();
      } catch (cleanupError) {
        throw new InstallCleanupError(failureDetail(cleanupError));
      }
    }
    if (backupComplete) await restoreDatabase(settings.dataDirectory, backup);
    await rm(paths.runtime, { recursive: true, force: true });
    await rm(paths.installed, { force: true });
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
