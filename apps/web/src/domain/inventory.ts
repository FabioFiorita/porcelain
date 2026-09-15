import type {
  InventoryResponse,
  ProjectDiscoveryResponse,
  ProjectFolderResponse,
  ProjectResponse,
} from '@porcelain/contracts/inventory';

export type ProjectDiscovery = ProjectDiscoveryResponse;
export type ProjectFolder = ProjectFolderResponse;

export type Inventory = InventoryResponse;
export type Project = ProjectResponse;

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

export function firstAvailableWorktree(inventory: Inventory) {
  const worktrees = inventory.projects.flatMap((project) => project.worktrees);
  return (
    worktrees.find((worktree) => worktree.available && !worktree.main) ??
    worktrees.find((worktree) => worktree.available)
  );
}

export function worktreeLabel(branch: string | null) {
  return branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD';
}

/**
 * A project does not have a path of its own in the inventory contract. The
 * main worktree is the stable display path, with the first worktree as the
 * fallback for repositories that have no main checkout.
 */
export function projectPath(project: Project) {
  return (
    project.worktrees.find((worktree) => worktree.main)?.path ??
    project.worktrees[0]?.path ??
    ''
  );
}
