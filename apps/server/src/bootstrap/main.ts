import { homedir } from 'node:os';
import { parseCliArguments } from '../cli/arguments.ts';
import { runCommand } from '../cli/commands.ts';
import type { StartServer } from '../cli/launcher.ts';
import { OwnerRequestError } from '../cli/owner-client.ts';
import { ServiceCommandError } from '../cli/service.ts';
import { installShutdownSignals } from '../cli/signals.ts';
import { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
import { SocketPathTooLongError } from '../config/errors/socket-path-too-long-error.ts';
import type { PorcelainEnvironment } from '../config/startup-settings.ts';
import { DataDirectoryInsecureError } from './errors/data-directory-insecure-error.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from './errors/owner-socket-unreadable-error.ts';
import { startRuntime } from './runtime.ts';

const actionableErrors = [
  ServeConfigurationError,
  OwnerRequestError,
  ServiceCommandError,
  DataDirectoryOwnedError,
  DataDirectoryInsecureError,
  OwnerSocketUnreadableError,
  SocketPathTooLongError,
];

export type CliDependencies = {
  homeDirectory?: string;
  webRoot?: string;
  startServer?: StartServer;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

function failureMessage(error: unknown): string {
  return actionableErrors.some((actionable) => error instanceof actionable) &&
    error instanceof Error
    ? error.message
    : 'Porcelain could not start. Check the build, data directory, and port.';
}

export async function runCli(
  args: readonly string[] = process.argv.slice(2),
  environment: PorcelainEnvironment = process.env,
  dependencies: CliDependencies = {},
): Promise<void> {
  const shutdown = new AbortController();
  const stdout =
    dependencies.stdout ?? ((message: string) => process.stdout.write(message));
  const stderr =
    dependencies.stderr ?? ((message: string) => process.stderr.write(message));
  const removeShutdownSignals = installShutdownSignals(shutdown);
  try {
    const homeDirectory = dependencies.homeDirectory ?? homedir();
    const command = parseCliArguments(
      args,
      environment,
      homeDirectory,
      dependencies.webRoot,
    );
    const exitCode = await runCommand(command, {
      signal: shutdown.signal,
      homeDirectory,
      startServer: dependencies.startServer ?? startRuntime,
      stdout,
      stderr,
    });
    if (exitCode !== 0) process.exitCode = exitCode;
  } catch (error) {
    if (!shutdown.signal.aborted) {
      stderr(`${failureMessage(error)}\n`);
      process.exitCode = 1;
    }
  } finally {
    removeShutdownSignals();
  }
}

if (import.meta.main) await runCli();
