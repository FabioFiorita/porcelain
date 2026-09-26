import type { ListedWorktree } from './listed-worktree.ts';

export type ProjectWorktrees = {
  projectId: string;
  available: boolean;
  worktrees: ListedWorktree[];
};
