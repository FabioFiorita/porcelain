import {
  navigatorCardChangesLabel,
  navigatorChecksLabel,
  navigatorRowTitle,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';

export function worktreeChecksLabel(
  checks: Parameters<typeof navigatorChecksLabel>[0],
) {
  return !checks || checks.state === 'loading'
    ? undefined
    : navigatorChecksLabel(checks);
}

export function worktreeRow(entry: NavigatorEntry) {
  const title = navigatorRowTitle(entry);
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
