import { startRuntime } from '../bootstrap/runtime.ts';
import type { ServeSettings } from './arguments.ts';
import {
  runLocalServer as serveLocally,
  type LauncherDependencies,
} from './launcher.ts';

export { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
export { parseCliArguments, type ServeSettings } from './arguments.ts';
export { serveHelp } from './help.ts';
export { installShutdownSignals } from './signals.ts';
export { reportStatus, statusExitCodes } from './status.ts';

export function runLocalServer(
  settings: ServeSettings,
  signal: AbortSignal,
  dependencies: Partial<LauncherDependencies> = {},
): Promise<void> {
  return serveLocally(settings, signal, {
    startServer: startRuntime,
    ...dependencies,
  });
}
