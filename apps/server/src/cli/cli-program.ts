import { Effect, Ref, Result } from 'effect';
import { CliError, Command } from 'effect/cli';
import { porcelainCommand, CliExit } from './command-tree.ts';

export const cliProgram = Effect.fn('Cli.run')(function* (
  args: readonly string[],
  version: string,
) {
  const exitCode = yield* Ref.make(0);
  yield* Command.runWith(porcelainCommand, { version })(args).pipe(
    Effect.provideService(CliExit, exitCode),
    Effect.catchFilter(
      (error) =>
        CliError.isCliError(error) ? Result.succeed(error) : Result.fail(error),
      () => Ref.set(exitCode, 1),
    ),
  );
  return yield* Ref.get(exitCode);
});
