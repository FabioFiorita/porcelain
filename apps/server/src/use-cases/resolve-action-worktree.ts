import type { GitActionScope } from '../models/git-action.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { resolveInspectionWorktree } from './resolve-inspection-worktree.ts';

export function resolveActionWorktree(
  store: InventoryStore,
  scope: GitActionScope,
) {
  const project = store
    .read()
    .projects.find((entry) => entry.id === scope.projectId);
  if (!project?.worktrees.some((entry) => entry.id === scope.worktreeId))
    throw new WorktreeNotFoundError();
  return resolveInspectionWorktree(store, scope.worktreeId);
}
