import type { Worktree } from '@porcelain/kernel/models';

export type CollectAbsentWorktreesResult = { collected: string[] };

export type CollectAbsentWorktreesOptions = { graceMs: number };

export type RecordedWorktreesResult = { worktrees: Worktree[] };
