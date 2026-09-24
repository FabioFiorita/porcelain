import type { ListedWorktree } from './listed-worktree.ts';

export type WorktreeListing =
  | {
      projectId: string;
      outcome: 'listed';
      worktrees: ListedWorktree[];
      unidentified: number;
    }
  | {
      projectId: string;
      outcome: 'unavailable' | 'timed-out' | 'moved';
      lastSeen: ListedWorktree[];
    };

export type ProjectWorktrees = {
  projectId: string;
  available: boolean;
  complete: boolean;
  worktrees: ListedWorktree[];
};
