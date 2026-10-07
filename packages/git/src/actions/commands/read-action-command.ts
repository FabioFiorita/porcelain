import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import { processFailure } from '../parsers/parse-process-result.ts';

export const readActionCommand = Effect.fn('Git.readActionCommand')(function* (
  process: GitProcessRunner,
  args: readonly string[],
  input?: string,
): Effect.fn.Return<string, ActionFailure, ActionPlatform> {
  const result = yield* process.execute(args, input);
  const failure = processFailure(result);
  if (failure)
    return yield* new GitActionRejectedError({
      reason: failure.reason ?? 'GIT_REJECTED',
    });
  return yield* Effect.try({
    try: () => new TextDecoder('utf8', { fatal: true }).decode(result.stdout),
    catch: (cause) =>
      new GitActionRejectedError({ reason: 'GIT_REJECTED', cause }),
  });
});
