import type { ListedWorktree } from '../models/listed-worktree.ts';

export function unavailableWorktrees(
  worktrees: readonly ListedWorktree[],
): ListedWorktree[] {
  return worktrees.map(({ headCommittedAt: _, ...worktree }) => ({
    ...worktree,
    available: false,
  }));
}
