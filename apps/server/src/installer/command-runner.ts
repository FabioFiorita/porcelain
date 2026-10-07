import { Effect } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import {
  runCommand as runProcess,
  type ProcessGroupLimits,
} from '@porcelain/process';

type CommandResult = { code: number; stdout: string; stderr: string };

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string | undefined },
) => Effect.Effect<CommandResult>;

export const commandRunner = Effect.fn('commandRunner')(function* (limits: {
  timeoutMs: number;
  maxBytes: number;
  processGroup: ProcessGroupLimits;
}) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return Effect.fn('Installer.runCommand')(
    function* (
      command: string,
      args: readonly string[],
      options?: { cwd?: string | undefined },
    ) {
      const output = yield* runProcess({
        command,
        args,
        cwd: options?.cwd,
        timeoutMs: limits.timeoutMs,
        maxBytes: limits.maxBytes,
        processGroup: limits.processGroup,
      });
      const stdout = output.stdout.toString('utf8');
      const stderr = output.stderr.toString('utf8');
      const completed =
        output.stopped === undefined || output.stopped === 'lingering';
      if (completed && output.exitCode === 0)
        return { code: 0, stdout, stderr };
      return {
        code: output.exitCode || 1,
        stdout,
        stderr:
          stderr.length > 0
            ? stderr
            : `Command failed: ${[command, ...args].join(' ')}`,
      };
    },
    Effect.catch((error) =>
      Effect.succeed({ code: 1, stdout: '', stderr: error.message }),
    ),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
  ) satisfies CommandRunner;
});
