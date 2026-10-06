import { runCommand, type ProcessGroupLimits } from '@porcelain/process';
import { Effect } from 'effect';
import { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';

type ProviderCommand = {
  readonly command: string;
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
    stdin: input.prompt,
    timeoutMs: input.timeoutMs,
    maxBytes: input.maxBytes,
    processGroup: input.processGroup,
  }).pipe(
    Effect.mapError((cause) => new ProviderProcessFailedError({ cause })),
  );
  if (
    output.exitCode === 0 &&
    output.stopped !== 'output-limit' &&
    output.groupStopped
  )
    return output.stdout.toString('utf8');
  return yield* Effect.fail(new ProviderProcessFailedError());
});
