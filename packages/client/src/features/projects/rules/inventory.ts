import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

export type Inventory = ReadInventoryResponse;
export type Project = Inventory['projects'][number];

export function worktreeLabel(branch: string | null | undefined) {
  return branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD';
}

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

function firstAvailableWorktree(inventory: Inventory) {
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

export function projectPath(project: Project) {
  return (
    project.worktrees.find((worktree) => worktree.main)?.path ??
    project.worktrees[0]?.path ??
    ''
  );
}

export function projectUnavailableMessage(
  project: Pick<Project, 'unavailableReason'>,
): string {
  switch (project.unavailableReason) {
    case 'moved':
      return 'This folder now holds a different repository; remove this project and add it again.';
    case 'missing':
      return 'The repository folder is missing; restore it and retry, or remove this project.';
    case 'permission':
      return 'Porcelain cannot read this repository; allow access to its folder and retry.';
    default:
      return 'Git could not read this repository; check that Git works in its folder and retry.';
  }
}
