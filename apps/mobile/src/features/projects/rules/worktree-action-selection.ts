import type { ProjectSelectionSnapshot } from '@porcelain/client/projects';

export function worktreeActionSelected(
  selection: Pick<
    ProjectSelectionSnapshot,
    'currentEnvironmentId' | 'selections'
  >,
  target: { environmentId: string; projectId: string; worktreeId: string },
) {
  const current = selection.selections[target.environmentId];
  return (
    selection.currentEnvironmentId === target.environmentId &&
    current?.projectId === target.projectId &&
    current.worktreeId === target.worktreeId
  );
}
