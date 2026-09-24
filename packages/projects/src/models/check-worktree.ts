import type { Worktree } from '@porcelain/kernel/models';

export type CheckWorktreeInput = {
  worktreeId: string;
  projectId?: string | undefined;
  purpose: 'reading' | 'writing';
};

export type CheckWorktreeResult = Worktree;
