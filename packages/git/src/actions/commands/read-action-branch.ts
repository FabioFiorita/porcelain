import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import {
  HEAD_BRANCH_ARGS,
  parseSymbolicRef,
} from '../../shared/parsers/refs.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export const readActionBranch = Effect.fn('Git.readActionBranch')(function* (
  process: GitProcessRunner,
): Effect.fn.Return<string | null, ActionFailure, ActionPlatform> {
  const result = yield* process.execute(HEAD_BRANCH_ARGS);
  const failure = processFailure(result);
  if (failure?.state === 'indeterminate')
    return yield* new GitActionRejectedError({
      reason: failure.reason ?? 'GIT_REJECTED',
    });
  return parseSymbolicRef(result);
});
