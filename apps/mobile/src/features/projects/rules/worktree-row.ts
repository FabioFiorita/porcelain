import {
  navigatorCardChangesLabel,
  navigatorCardReviewLabel,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeRow(entry: NavigatorEntry) {
  return {
    title: entry.detached ? entry.name : entry.branch || entry.name,
    review: navigatorCardReviewLabel(entry),
    changes:
      entry.kind === 'worktree' ? navigatorCardChangesLabel(entry.changes) : '',
  };
}
