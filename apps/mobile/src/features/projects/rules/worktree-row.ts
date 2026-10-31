import {
  navigatorCardChangesLabel,
  navigatorCardReviewLabel,
  navigatorDiffSummary,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeRow(entry: NavigatorEntry) {
  const diff = navigatorDiffSummary(entry.changes);
  return {
    title: entry.detached ? entry.name : entry.branch || entry.name,
    review: navigatorCardReviewLabel(entry),
    changes:
      entry.kind === 'worktree' ? navigatorCardChangesLabel(entry.changes) : '',
    diff,
  };
}
