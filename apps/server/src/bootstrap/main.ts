import { homedir } from 'node:os';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { parseCliArguments } from '../cli/arguments.ts';
import { runCommand } from '../cli/commands.ts';
import type { StartServer } from '../cli/launcher.ts';
import { OwnerRequestError, probeOwnerSocket } from '../cli/owner-client.ts';
import { isServiceFailure } from '../cli/service.ts';
import { installShutdownSignals } from '../cli/signals.ts';
import {
  writeStandardError,
  writeStandardOutput,
} from '../cli/standard-output.ts';
import { ServeConfigurationError } from '../config/errors/serve-configuration-error.ts';
import { SocketPathTooLongError } from '../config/errors/socket-path-too-long-error.ts';
import type { PorcelainEnvironment } from '../config/environment-settings.ts';
import { DataDirectoryInsecureError } from '../runtime/errors/data-directory-insecure-error.ts';
import { DataDirectoryOwnedError } from '../runtime/errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from '../runtime/errors/owner-socket-unreadable-error.ts';
import { startApplication } from '../runtime/start-application.ts';
import { openServer } from './compose-server.ts';

const actionableErrors = [
  ServeConfigurationError,
  OwnerRequestError,
  DataDirectoryOwnedError,
  DataDirectoryInsecureError,
  OwnerSocketUnreadableError,
  SocketPathTooLongError,
];

export const startServer: StartServer = (settings, signal) =>
  startApplication(settings, signal, {
    openServer,
    ownerProbe: probeOwnerSocket,
    clock: new SystemClock(),
  });

export type CliDependencies = {
  homeDirectory?: string;
  webRoot?: string;
  startServer?: StartServer;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

function failureMessage(error: unknown): string {
  const actionable =
    isServiceFailure(error) ||
    actionableErrors.some((known) => error instanceof known);
  return actionable && error instanceof Error
    ? error.message
    : 'Porcelain could not start. Check the build, data directory, and port.';
}

export async function runCli(
  args: readonly string[] = process.argv.slice(2),
  environment: PorcelainEnvironment = process.env,
  dependencies: CliDependencies = {},
): Promise<void> {
  const shutdown = new AbortController();
  const stdout = dependencies.stdout ?? writeStandardOutput;
  const stderr = dependencies.stderr ?? writeStandardError;
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
      searchPath: environment.PATH ?? '',
      clock: new SystemClock(),
      startServer: dependencies.startServer ?? startServer,
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
