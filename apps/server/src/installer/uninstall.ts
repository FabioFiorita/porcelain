import { Effect, FileSystem } from 'effect';
import type { InstallerContext } from './context.ts';
import { UnrecognizedUnitError } from './errors/unrecognized-unit-error.ts';
import { readInstalledRecord } from './records.ts';
import { recoverInterruptedUpdate } from './recover-interrupted-update.ts';

export const uninstall = Effect.fn('Installer.uninstall')(function* (
  context: InstallerContext,
) {
  const fs = yield* FileSystem.FileSystem;
  const { paths, systemd } = context;
  yield* recoverInterruptedUpdate(context);
  const installed = yield* readInstalledRecord(paths.installed);
  if (installed === undefined) {
    if (yield* systemd.unitExists())
      return yield* Effect.fail(
        new UnrecognizedUnitError({ unitPath: systemd.unitPath }),
      );
    return false;
  }
  yield* systemd.uninstall();
  yield* fs.remove(paths.runtime, { recursive: true, force: true });
  yield* fs.remove(paths.installed, { force: true });
  return true;
});
