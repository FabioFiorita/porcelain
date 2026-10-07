import { Effect } from 'effect';
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

export const readServiceStatus = Effect.fn('Installer.readServiceStatus')(
  function* (context: InstallerContext) {
    const [installed, probe, unitExists] = yield* Effect.all([
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
  },
);
