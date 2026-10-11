import type { ProjectUnavailableReason } from './project-unavailable-reason.ts';
import type { ListedWorktree } from './listed-worktree.ts';

export type ProjectWorktrees = {
  projectId: string;
  available: boolean;
  unavailableReason?: ProjectUnavailableReason | undefined;
  worktrees: ListedWorktree[];
};
