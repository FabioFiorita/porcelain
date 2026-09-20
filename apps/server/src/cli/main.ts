import { homedir } from 'node:os';
import type { ServeEnvironment } from './arguments.ts';
import {
  parseCliArguments,
  ServeConfigurationError,
  serveHelp,
} from './index.ts';
import { type LauncherDependencies, runLocalServer } from './launcher.ts';
import { installShutdownSignals } from './signals.ts';
import { reportStatus, statusExitCodes } from './status.ts';

export type CliDependencies = LauncherDependencies & {
  homeDirectory?: string;
  webRoot?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

function formatStartupError(error: unknown): string {
  if (error instanceof ServeConfigurationError) return error.message;
  if (
    error instanceof Error &&
    (error.name === 'DataDirectoryOwnedError' ||
      error.name === 'DataDirectoryInsecureError' ||
      error.name === 'SocketPathTooLongError')
  )
    return error.message;
  return 'Porcelain could not start. Check the build, data directory, and port.';
}

/**
 * Run the installed command-line launcher.  The package bin calls this
 * function explicitly; it intentionally does not depend on an argv path guard.
 * This is the composition root: the one place that resolves a default home
 * directory, which everything below it then receives explicitly.
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
    const parsed = parseCliArguments(
      args,
      environment,
      dependencies.homeDirectory ?? homedir(),
      dependencies.webRoot,
    );
    if (parsed.command === 'help') {
      stdout(serveHelp);
      return;
    }
    if (parsed.command === 'status') {
      const code = await reportStatus(parsed.settings, { stdout, stderr });
      if (code !== statusExitCodes.running) process.exitCode = code;
      return;
    }
    await runLocalServer(parsed.settings, controller.signal, dependencies);
  } catch (error) {
    if (!controller.signal.aborted) {
      stderr(`${formatStartupError(error)}\n`);
      process.exitCode = 1;
    }
  } finally {
    removeShutdownSignals();
  }
}
