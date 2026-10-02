import type { Inventory, Project } from '@porcelain/client/projects/rules';

export {
  worktreeLabel,
  type Inventory,
  type Project,
} from '@porcelain/client/projects/rules';
export type WorktreeTarget = {
  remote: string | null;
  projectId: string;
  worktreeId: string;
};

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

export function projectPath(project: Project) {
  return (
    project.worktrees.find((worktree) => worktree.main)?.path ??
    project.worktrees[0]?.path ??
    ''
  );
}
