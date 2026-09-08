import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';

export async function readActionCommand(
  process: GitProcessRunner,
  args: string[],
  signal: AbortSignal,
): Promise<string> {
  const result = await process.execute(args, signal);
  const failure = processFailure(result);
  if (failure)
    throw new GitActionRejectedError(failure.reason ?? 'GIT_REJECTED');
  signal.throwIfAborted();
  return new TextDecoder('utf8', { fatal: true }).decode(result.stdout);
}
