import type { ListedWorktree } from '../models/listed-worktree.ts';

export function unavailableWorktrees(
  worktrees: readonly ListedWorktree[],
): ListedWorktree[] {
  return worktrees.map((worktree) => ({ ...worktree, available: false }));
}
