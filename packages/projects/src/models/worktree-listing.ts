import type { ListedWorktree } from './listed-worktree.ts';

export type WorktreeListing =
  | {
      kind: 'listed';
      projectId: string;
      repositoryIdentity: string;
      worktrees: ListedWorktree[];
      unidentified: number;
    }
  | {
      kind: 'unavailable' | 'timed-out';
      projectId: string;
    };
