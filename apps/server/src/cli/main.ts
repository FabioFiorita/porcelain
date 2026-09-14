import { homedir } from 'node:os';
import type { ServeEnvironment } from './arguments.ts';
import {
  parseServeSettings,
  ServeConfigurationError,
  serveHelp,
} from './index.ts';
import { type LauncherDependencies, runLocalServer } from './launcher.ts';
import { installShutdownSignals } from './signals.ts';

export type CliDependencies = LauncherDependencies & {
  homeDirectory?: string;
  webRoot?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

function formatStartupError(error: unknown): string {
  if (error instanceof ServeConfigurationError) return error.message;
  if (error instanceof Error && error.name === 'DataDirectoryOwnedError')
    return error.message;
  return 'Porcelain could not start. Check the build, data directory, and port.';
}

/**
 * Run the installed command-line launcher.  The package bin calls this
 * function explicitly; it intentionally does not depend on an argv path guard.
 */
export async function runCli(
  args: readonly string[] = process.argv.slice(2),
  environment: ServeEnvironment = process.env,
  dependencies: CliDependencies = {},
): Promise<void> {
  const controller = new AbortController();
  const stdout =
    dependencies.stdout ?? ((message: string) => process.stdout.write(message));
  const stderr =
    dependencies.stderr ?? ((message: string) => process.stderr.write(message));
  const removeShutdownSignals = installShutdownSignals(controller);
  try {
    const parsed = parseServeSettings(
      args,
      environment,
      dependencies.homeDirectory ?? homedir(),
      dependencies.webRoot,
    );
    if ('help' in parsed) {
      stdout(serveHelp);
      return;
    }
    await runLocalServer(parsed, controller.signal, dependencies);
  } catch (error) {
    if (!controller.signal.aborted) {
      stderr(`${formatStartupError(error)}\n`);
      process.exitCode = 1;
    }
  } finally {
    removeShutdownSignals();
  }
}
