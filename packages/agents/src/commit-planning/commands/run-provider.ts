import { runCommand, type ProcessGroupLimits } from '@porcelain/process';
import { Effect } from 'effect';
import { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';

type ProviderCommand = {
  readonly command: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly prompt: string;
  readonly maxBytes: number;
  readonly timeoutMs: number;
  readonly processGroup: ProcessGroupLimits;
};

export const runProvider = Effect.fn('Provider.run')(function* (
  input: ProviderCommand,
) {
  const output = yield* runCommand({
    command: input.command,
    args: input.args,
    cwd: input.cwd,
    env: input.env,
    stdin: input.prompt,
    timeoutMs: input.timeoutMs,
    maxBytes: input.maxBytes,
    processGroup: input.processGroup,
  }).pipe(
    Effect.mapError((cause) => new ProviderProcessFailedError({ cause })),
  );
  if (
    output.exitCode === 0 &&
    output.stopped === undefined &&
    output.groupStopped
  )
    return output.stdout.toString('utf8');
  return yield* Effect.fail(
    new ProviderProcessFailedError({
      reason: output.stopped === 'deadline' ? 'deadline' : 'exit',
      detail: output.stderr.toString('utf8') + output.stdout.toString('utf8'),
    }),
  );
});
