import type { InstallerContext } from './context.ts';
import { readInstalledRecord } from './records.ts';
import type { Linger } from './systemd-service.ts';

export type ServiceStatus = {
  installed: boolean;
  version: string | undefined;
  enabled: boolean;
  running: boolean;
  linger: Linger;
  unitPath: string;
  stdoutLog: string;
  stderrLog: string;
};

export async function readServiceStatus(
  context: InstallerContext,
): Promise<ServiceStatus> {
  const [installed, probe, unitExists] = await Promise.all([
    readInstalledRecord(context.paths.installed),
    context.systemd.probe(),
    context.systemd.unitExists(),
  ]);
  return {
    installed: installed !== undefined && unitExists,
    version: installed?.version,
    ...probe,
    unitPath: context.systemd.unitPath,
    stdoutLog: context.paths.stdoutLog,
    stderrLog: context.paths.stderrLog,
  };
}
