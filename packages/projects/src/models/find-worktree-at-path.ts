import type { ProjectWorktrees } from './project-worktrees.ts';

export type FindWorktreeAtPathInput = {
  path: string;
  listings: readonly ProjectWorktrees[];
};

export type FindWorktreeAtPathResult = { worktreeId: string };
