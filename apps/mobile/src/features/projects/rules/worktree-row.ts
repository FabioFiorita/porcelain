import {
  navigatorCardChangesLabel,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeRow(entry: NavigatorEntry) {
  const title =
    entry.displayTitle ??
    (entry.detached ? entry.name : entry.branch || entry.name);
  const branch = entry.displayTitle === undefined ? '' : entry.branch;
  const changes =
    entry.kind === 'worktree' ? navigatorCardChangesLabel(entry.changes) : '';
  return {
    title,
    branch,
    changes,
    accessibilityLabel: [
      title,
      branch,
      entry.main ? 'Main worktree' : undefined,
      entry.detached ? 'Detached HEAD' : undefined,
      entry.detached ? entry.path : undefined,
      entry.projectName,
      entry.environmentName,
      changes,
    ]
      .filter(Boolean)
      .join(', '),
  };
}
