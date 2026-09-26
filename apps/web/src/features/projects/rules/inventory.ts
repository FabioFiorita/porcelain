import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

export type Inventory = ReadInventoryResponse;
export type Project = Inventory['projects'][number];

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

export function firstWaitingWorktree(inventory: Inventory) {
  const worktrees = inventory.projects.flatMap((project) => project.worktrees);
  return (
    worktrees.find(
      (worktree) =>
        worktree.available &&
        (worktree.status === 'replied' || worktree.status === 'pending'),
    ) ?? firstAvailableWorktree(inventory)
  );
}

export function worktreeLabel(branch: string | null | undefined) {
  return branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD';
}

export function projectPath(project: Project) {
  return (
    project.worktrees.find((worktree) => worktree.main)?.path ??
    project.worktrees[0]?.path ??
    ''
  );
}
