import type { Worktree } from './worktree.ts';

export type WorktreeListing =
  | {
      projectId: string;
      outcome: 'listed';
      worktrees: Worktree[];
      unidentified: number;
    }
  | {
      projectId: string;
      outcome: 'unavailable' | 'timed-out' | 'moved';
      lastSeen: Worktree[];
    };

export type ProjectWorktrees = {
  projectId: string;
  available: boolean;
  complete: boolean;
  worktrees: Worktree[];
};
