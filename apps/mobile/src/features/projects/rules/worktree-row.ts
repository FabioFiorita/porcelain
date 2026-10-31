import {
  navigatorCardChangesLabel,
  navigatorCardReviewLabel,
  navigatorDiffSummary,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeRow(entry: NavigatorEntry) {
  const diff = navigatorDiffSummary(entry.changes);
  const clean =
    entry.changes.state === 'available' && entry.changes.count === 0 && !diff;
  return {
    title: entry.detached ? entry.name : entry.branch || entry.name,
    review: navigatorCardReviewLabel(entry),
    changes: clean ? '' : navigatorCardChangesLabel(entry.changes),
    diff,
  };
}
