import {
  HEAD_BRANCH_ARGS,
  parseSymbolicRef,
} from '../../shared/parsers/refs.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export async function readActionBranch(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<string | null> {
  const result = await process.execute(HEAD_BRANCH_ARGS, signal);
  const failure = processFailure(result);
  if (failure?.state === 'indeterminate')
    throw new GitActionRejectedError(failure.reason ?? 'GIT_REJECTED');
  return parseSymbolicRef(result);
}
