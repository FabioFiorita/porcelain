import type { ListedWorktree } from './listed-worktree.ts';

export type CheckWorktreeInput = {
  worktreeId: string;
  projectId?: string | undefined;
  requireAvailableProject: boolean;
};

export type CheckWorktreeOptions = { staleAfterMs: number };

export type CheckWorktreeResult =
  | { kind: 'found'; worktree: ListedWorktree }
  | { kind: 'stale' };

export type CheckRefreshedWorktreeResult = ListedWorktree;

export type WorktreeCheckAnswer =
  | CheckWorktreeResult
  | { kind: 'missing' }
  | { kind: 'unavailable' };

export type ConfirmWorktreeInput = { worktree: ListedWorktree };
