import { rm } from 'node:fs/promises';
import type { InstallerContext } from './context.ts';
import { UnrecognizedUnitError } from './errors/unrecognized-unit-error.ts';
import { readInstalledRecord } from './records.ts';
import { recoverInterruptedUpdate } from './recover-interrupted-update.ts';

export async function uninstall(context: InstallerContext): Promise<boolean> {
  const { paths, systemd } = context;
  await recoverInterruptedUpdate(context);
  const installed = await readInstalledRecord(paths.installed);
  if (installed === undefined) {
    if (await systemd.unitExists())
      throw new UnrecognizedUnitError(systemd.unitPath);
    return false;
  }
  await systemd.uninstall();
  await rm(paths.runtime, { recursive: true, force: true });
  await rm(paths.installed, { force: true });
  return true;
}
