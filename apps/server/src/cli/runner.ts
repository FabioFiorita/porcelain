import { homedir } from 'node:os';
import { NodeRuntime } from '@effect/platform-node';
import {
  Cause,
  ConfigProvider,
  Console,
  Context,
  Effect,
  Exit,
  Layer,
  Runtime,
  type Clock,
} from 'effect';
import type { Command } from 'effect/cli';
import {
  EnvironmentSettings,
  type PorcelainEnvironment,
} from '../config/environment-settings.ts';
import type { Limits } from '../config/limits.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { readPackageVersion } from '../installer/index.ts';
import { cliProgram } from './cli-program.ts';
import { CliHost, CliOperations } from './operations.ts';
import { CliInvocation, defaultWebRoot } from './settings.ts';
import { OwnerRequestError } from './errors/owner-request-error.ts';
import { isServiceFailure, cliPackageRoot } from './service.ts';
import { writeStandardError, writeStandardOutput } from './standard-output.ts';
import type { StartServer } from './launcher.ts';

type ActionableError = abstract new (...args: never[]) => Error;

export function runMain(program: Effect.Effect<number>): void {
  NodeRuntime.runMain(program, {
    teardown: (exit, onExit) =>
      Runtime.defaultTeardown(exit, (code) =>
        onExit(
          Exit.isSuccess(exit) && typeof exit.value === 'number'
            ? exit.value
            : code,
        ),
      ),
  });
}

export class CliRuntime extends Context.Service<
  CliRuntime,
  {
    readonly startServer: StartServer;
    readonly ownerProbe: OwnerProbe;
    readonly clock: Clock.Clock;
    readonly limits: Limits;
    readonly actionableErrors: readonly ActionableError[];
  }
>()('@porcelain/server/CliRuntime') {}

function startupFailureMessage(
  error: unknown,
  actionableErrors: readonly ActionableError[],
): string {
  const actionable =
    isServiceFailure(error) ||
    error instanceof OwnerRequestError ||
    actionableErrors.some((known) => error instanceof known);
  return actionable && error instanceof Error
    ? error.message
    : 'Porcelain could not start. Check the build, data directory, and port.';
}

type CliOptions = {
  readonly homeDirectory?: string;
  readonly startServer?: StartServer;
  readonly stdout?: (message: string) => void;
  readonly stderr?: (message: string) => void;
  readonly prepareWebRoot?: Effect.Effect<string>;
};

export function createCliRunner(
  runtime: Layer.Layer<CliRuntime>,
  platform: Layer.Layer<
    | Command.Environment
    | Exclude<Layer.Services<typeof CliOperations.layer>, CliHost>
  >,
) {
  return function runCli(
    args: readonly string[] = process.argv.slice(2),
    environment: PorcelainEnvironment = process.env,
    options: CliOptions = {},
  ): Effect.Effect<number> {
    const stdout = options.stdout ?? writeStandardOutput;
    const stderr = options.stderr ?? writeStandardError;
    const homeDirectory = options.homeDirectory ?? homedir();
    const host = Layer.effect(
      CliHost,
      Effect.gen(function* () {
        const configured = yield* CliRuntime;
        return {
          startServer: options.startServer ?? configured.startServer,
          ownerProbe: configured.ownerProbe,
          clock: configured.clock,
          limits: configured.limits,
          homeDirectory,
          searchPath: environment.PATH ?? '',
          stdout,
          stderr,
          prepareWebRoot: options.prepareWebRoot,
        };
      }),
    ).pipe(Layer.provide(runtime));
    const services = Layer.mergeAll(
      CliOperations.layer.pipe(Layer.provide(Layer.merge(host, platform))),
      Layer.succeed(CliInvocation, { homeDirectory, webRoot: defaultWebRoot }),
      EnvironmentSettings.layer,
      ConfigProvider.layer(ConfigProvider.fromEnvRecord({ ...environment })),
      platform,
    );
    const output: Console.Console = {
      ...console,
      log: (...values: readonly unknown[]) => stdout(`${values.join(' ')}\n`),
      error: (...values: readonly unknown[]) => stderr(`${values.join(' ')}\n`),
    };
    const program = Effect.gen(function* () {
      const configured = yield* CliRuntime;
      return yield* Effect.gen(function* () {
        const version = yield* readPackageVersion(cliPackageRoot()).pipe(
          Effect.orDie,
        );
        return yield* cliProgram(args, version ?? '0.0.0');
      }).pipe(
        Effect.provideService(Console.Console, output),
        Effect.provide(services),
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.interrupt
            : Effect.sync(() => {
                stderr(
                  `${startupFailureMessage(Cause.squash(cause), configured.actionableErrors)}\n`,
                );
                return 1;
              }),
        ),
      );
    }).pipe(Effect.provide(runtime));

    return program;
  };
}
