import type {
  InventoryResponse,
  ProjectResponse,
} from '@porcelain/contracts/inventory';

export type Inventory = InventoryResponse;
export type Project = ProjectResponse;

// A worktree is only reviewable with its owning project, so both are resolved
// together rather than rediscovering the project at the call site.
export function selectedWorktreeInProject(
  inventory: Inventory,
  id: string | undefined,
) {
  for (const project of inventory.projects) {
    const worktree = project.worktrees.find((entry) => entry.id === id);
    if (worktree) return { worktree, projectId: project.id };
  }
  return undefined;
}

export function worktreeLabel(branch: string | null) {
  return branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD';
}
