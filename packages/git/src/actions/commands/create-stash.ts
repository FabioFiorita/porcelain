import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';

export const createStash = Effect.fn('Git.createStash')(function* (
  process: GitProcessRunner,
  command: GitActionCommand<'stash-create'>,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const { intent, preview } = command;
  if (
    !preview.trackedChanges &&
    !(intent.includeUntracked && preview.untrackedCount)
  )
    return { state: 'no-change', refreshRequired: false };
  const pushed = yield* process.execute([
    'stash',
    'push',
    ...(intent.includeUntracked ? ['--include-untracked'] : []),
    '--message',
    intent.message,
  ]);
  const failure = processFailure(pushed);
  if (failure) return failure;
  const stashOid = (yield* readActionCommand(process, [
    'rev-parse',
    '--verify',
    'refs/stash',
  ])).trimEnd();
  return {
    state: 'succeeded',
    result: { stashOid, stashRetained: true },
    refreshRequired: true,
  };
});
