import type { WorkspaceChoice } from '@porcelain/client/projects/rules';

export function worktreeDescription(
  choice: WorkspaceChoice,
  row: WorkspaceChoice['worktrees'][number],
) {
  return [
    row.selected ? 'Current' : undefined,
    row.worktree.main ? 'Main checkout' : undefined,
    row.disabled ? 'Unavailable' : undefined,
    choice.worktrees.filter((entry) => entry.label === row.label).length > 1
      ? row.worktree.path
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}
