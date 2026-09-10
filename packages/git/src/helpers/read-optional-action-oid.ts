import { processFailure } from '../commands/action-outcome.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';

export async function readOptionalActionOid(
  process: GitProcessRunner,
  ref: string,
  signal: AbortSignal,
): Promise<string | null> {
  const result = await process.execute(
    ['rev-parse', '--verify', '--quiet', ref],
    signal,
  );
  const failure = processFailure(result);
  if (failure?.state === 'indeterminate')
    throw new GitActionRejectedError(failure.reason ?? 'GIT_REJECTED');
  signal.throwIfAborted();
  if (result.exitCode === 1) return null;
  if (result.exitCode !== 0 || result.interrupted)
    throw new GitActionRejectedError('GIT_REJECTED');
  return result.stdout.toString('utf8').trimEnd();
}
