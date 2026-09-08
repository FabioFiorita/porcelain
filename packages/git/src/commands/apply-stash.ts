import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';
import { removeAppliedStash } from './remove-applied-stash.ts';

export async function applyStash(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  snapshot: GitActionSnapshot,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = preparation.intent;
  if (intent.action !== 'stash-apply' && intent.action !== 'stash-pop')
    throw new Error('Invalid stash intent');
  const result = { stashOid: intent.stashOid, stashRetained: true };
  const command = await process.execute(
    [
      'stash',
      'apply',
      ...(intent.restoreIndex ? ['--index'] : []),
      intent.stashOid,
    ],
    signal,
  );
  const failure = processFailure(command);
  if (failure) {
    if (failure.state === 'indeterminate') return { ...failure, result };
    const unmerged = await readActionCommand(
      process,
      ['ls-files', '--unmerged', '-z'],
      signal,
    );
    return { ...failure, ...(unmerged ? { state: 'conflicted' } : {}), result };
  }
  if (intent.action === 'stash-apply')
    return { state: 'succeeded', result, refreshRequired: true };
  return removeAppliedStash(process, intent.stashOid, snapshot, signal);
}
