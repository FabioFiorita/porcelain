import type { Worktree } from '@porcelain/kernel/models';

export function worktreeInProject(
  worktree: Worktree,
  projectId: string,
): boolean {
  return worktree.projectId === projectId;
}
