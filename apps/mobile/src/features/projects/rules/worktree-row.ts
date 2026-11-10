import {
  navigatorCardChangesLabel,
  navigatorCardReviewLabel,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeRow(entry: NavigatorEntry) {
  return {
    title:
      entry.displayTitle ??
      (entry.detached ? entry.name : entry.branch || entry.name),
    branch: entry.displayTitle === undefined ? '' : entry.branch,
    review: navigatorCardReviewLabel(entry),
    changes:
      entry.kind === 'worktree' ? navigatorCardChangesLabel(entry.changes) : '',
  };
}
