import type { Worktree } from '@porcelain/kernel/models';

export type CheckWorktreeInput = {
  worktreeId: string;
  projectId?: string | undefined;
  purpose?: 'reading' | 'writing' | undefined;
};

export type CheckWorktreeResult = Worktree;
