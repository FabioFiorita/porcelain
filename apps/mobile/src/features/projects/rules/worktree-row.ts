import {
  navigatorChangesLabel,
  navigatorReviewLabel,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeRow(entry: NavigatorEntry) {
  return {
    title: entry.detached ? entry.name : entry.branch || entry.name,
    subtitle: [
      entry.main ? 'Main worktree' : undefined,
      entry.detached
        ? `Detached HEAD · ${entry.path?.slice(0, entry.path.lastIndexOf('/')) ?? entry.name}`
        : undefined,
      entry.kind === 'worktree'
        ? navigatorChangesLabel(entry.changes)
        : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
    detail: navigatorReviewLabel(entry.review),
  };
}
