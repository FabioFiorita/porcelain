import type { ProjectWorktrees } from './worktree-listing.ts';

export type ResolveWorktreeByPathInput = {
  path: string;
  listings: ProjectWorktrees[];
};

export type ResolveWorktreeByPathResult = { worktreeId: string };
