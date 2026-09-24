import { homedir } from 'node:os';
import type { Clock } from '@porcelain/kernel/ports';
import type { PorcelainEnvironment } from '../config/environment-settings.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { parseCliArguments } from './arguments.ts';
import { runCommand } from './commands.ts';
import type { StartServer } from './launcher.ts';
import { OwnerRequestError } from './owner-client.ts';
import { isServiceFailure } from './service.ts';
import { installShutdownSignals } from './signals.ts';
import { writeStandardError, writeStandardOutput } from './standard-output.ts';

export type ActionableError = abstract new (...args: never[]) => Error;

export type PorcelainCliRuntime = {
  startServer: StartServer;
  ownerProbe: OwnerProbe;
  clock: Clock;
  actionableErrors: readonly ActionableError[];
};

export type CliDependencies = {
  homeDirectory?: string;
  webRoot?: string;
  startServer?: StartServer;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

export class PorcelainCli {
  private readonly runtime: PorcelainCliRuntime;

  constructor(runtime: PorcelainCliRuntime) {
    this.runtime = runtime;
  }

  startupFailureMessage(error: unknown): string {
    const actionable =
      isServiceFailure(error) ||
      error instanceof OwnerRequestError ||
      this.runtime.actionableErrors.some((known) => error instanceof known);
    return actionable && error instanceof Error
      ? error.message
      : 'Porcelain could not start. Check the build, data directory, and port.';
  }

  async run(
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
        clock: this.runtime.clock,
        ownerProbe: this.runtime.ownerProbe,
        startServer: dependencies.startServer ?? this.runtime.startServer,
        stdout,
        stderr,
      });
      if (exitCode !== 0) process.exitCode = exitCode;
    } catch (error) {
      if (!shutdown.signal.aborted) {
        stderr(`${this.startupFailureMessage(error)}\n`);
        process.exitCode = 1;
      }
    } finally {
      removeShutdownSignals();
    }
  }
}
