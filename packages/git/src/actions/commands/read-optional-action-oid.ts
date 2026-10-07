import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export const readOptionalActionOid = Effect.fn('Git.readOptionalActionOid')(
  function* (
    process: GitProcessRunner,
    ref: string,
  ): Effect.fn.Return<string | null, ActionFailure, ActionPlatform> {
    const result = yield* process.execute([
      'rev-parse',
      '--verify',
      '--quiet',
      ref,
    ]);
    const failure = processFailure(result);
    if (failure?.state === 'indeterminate')
      return yield* new GitActionRejectedError({
        reason: failure.reason ?? 'GIT_REJECTED',
      });
    if (result.exitCode === 1) return null;
    if (result.exitCode !== 0 || result.interrupted)
      return yield* new GitActionRejectedError({ reason: 'GIT_REJECTED' });
    return result.stdout.toString('utf8').trimEnd();
  },
);
