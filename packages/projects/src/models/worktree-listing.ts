import type { ListedWorktree } from './listed-worktree.ts';

export type WorktreeListing =
  | {
      kind: 'listed';
      projectId: string;
      worktrees: ListedWorktree[];
      unidentified: number;
    }
  | {
      kind: 'unavailable' | 'timed-out' | 'moved';
      projectId: string;
    };
