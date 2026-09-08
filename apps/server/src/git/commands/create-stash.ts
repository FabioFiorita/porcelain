import type {
  GitActionOutcome,
  GitActionPreparation,
} from '../../models/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function createStash(
  process: GitProcessRunner,
  preparation: GitActionPreparation,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  if (intent.action !== 'stash-create') throw new Error('Invalid stash intent');
  if (
    !preparation.preview.trackedChanges &&
    !(intent.includeUntracked && preparation.preview.untrackedCount)
  )
    return { state: 'no-change', refreshRequired: false };
  const command = await process.execute(
    [
      'stash',
      'push',
      ...(intent.includeUntracked ? ['--include-untracked'] : []),
      '--message',
      intent.message,
    ],
    signal,
  );
  const failure = processFailure(command);
  if (failure) return failure;
  const stashOid = (
    await readActionCommand(
      process,
      ['rev-parse', '--verify', 'refs/stash'],
      signal,
    )
  ).trimEnd();
  return {
    state: 'succeeded',
    result: { stashOid, stashRetained: true },
    refreshRequired: true,
  };
}
