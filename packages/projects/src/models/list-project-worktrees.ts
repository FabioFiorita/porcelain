import type { ListableProject } from './project.ts';
import type { ProjectWorktrees } from './project-worktrees.ts';

export type ListProjectWorktreesInput = { project: ListableProject };

export type ListProjectWorktreesResult = ProjectWorktrees & {
  complete: boolean;
};
