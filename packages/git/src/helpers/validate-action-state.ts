import type { GitActionIntent } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';

export function validateActionState(
  intent: GitActionIntent,
  state: {
    headOid: string | null;
    branch: string | null;
    trackedChanges: boolean;
    untrackedCount: number;
  },
  stashLog: string,
): void {
  const { headOid, branch, trackedChanges, untrackedCount } = state;
  if (intent.action === 'commit' && !branch)
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  if (intent.action === 'push' && (!branch || !headOid))
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  if (intent.action.startsWith('stash-') && !headOid)
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  if (intent.action === 'stash-apply' || intent.action === 'stash-pop') {
    if (
      trackedChanges ||
      untrackedCount ||
      !stashLog
        .split('\n')
        .some((line) => line.split('\0')[0] === intent.stashOid)
    )
      throw new GitActionRejectedError('CHECKOUT_BUSY');
  }
}
