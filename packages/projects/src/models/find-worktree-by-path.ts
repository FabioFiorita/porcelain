import type { ProjectWorktrees } from './project-worktrees.ts';

export type FindWorktreeByPathInput = {
  path: string;
  listings: ProjectWorktrees[];
};

export type FindWorktreeByPathResult = { worktreeId: string };
