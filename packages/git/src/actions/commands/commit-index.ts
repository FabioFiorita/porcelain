import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { commitPaths } from './commit-paths.ts';
import { readActionHead } from './read-action-head.ts';

export const commitIndex = Effect.fn('Git.commitIndex')(function* (
  process: GitProcessRunner,
  command: GitActionCommand<'commit' | 'amend'>,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const { intent, preview } = command;
  if (intent.paths) return yield* commitPaths(process, command, intent.paths);
  if (!preview.staged) return { state: 'no-change', refreshRequired: false };
  const committed = yield* process.execute(
    ['commit', '--file=-', '--cleanup=verbatim'],
    intent.message,
  );
  const failure = processFailure(committed);
  if (failure) return failure;
  const headOid = yield* readActionHead(process);
  if (headOid === preview.headOid)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  return { state: 'succeeded', result: { headOid }, refreshRequired: true };
});
