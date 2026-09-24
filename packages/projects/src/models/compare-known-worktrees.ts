import type { ProjectWorktrees } from './project-worktrees.ts';

export type CompareKnownWorktreesInput = {
  before: ProjectWorktrees[];
  after: ProjectWorktrees[];
};

export type CompareKnownWorktreesResult = { changed: boolean };
