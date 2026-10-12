import { Console, Effect, Ref, Result } from 'effect';
import { CliError, Command } from 'effect/cli';
import {
  porcelainCommand,
  desktopMcpCommand,
  CliExit,
  CliVersion,
} from './command-tree.ts';

export const cliProgram = Effect.fn('Cli.run')(function* (
  args: readonly string[],
  version: string,
  mode: 'server' | 'desktop-mcp' = 'server',
) {
  const exitCode = yield* Ref.make(0);
  const program =
    mode === 'desktop-mcp'
      ? Command.runWith(desktopMcpCommand, { version })(args)
      : Command.runWith(porcelainCommand, { version })(args);
  const console = yield* Console.Console;
  yield* program.pipe(
    Effect.provideService(
      Console.Console,
      mode === 'desktop-mcp' ? { ...console, log: console.error } : console,
    ),
    Effect.provideService(CliExit, exitCode),
    Effect.provideService(CliVersion, version),
    Effect.catchFilter(
      (error) =>
        CliError.isCliError(error) ? Result.succeed(error) : Result.fail(error),
      () => Ref.set(exitCode, 1),
    ),
  );
  return yield* Ref.get(exitCode);
});
