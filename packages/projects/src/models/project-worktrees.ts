import type { ProjectUnavailableReason } from './project-unavailable-reason.ts';
import type { ListedWorktree } from './listed-worktree.ts';

export type ProjectWorktrees = {
  projectId: string;
  worktrees: ListedWorktree[];
} & (
  | { available: true; unavailableReason?: never }
  | {
      available: false;
      unavailableReason?: ProjectUnavailableReason | undefined;
    }
);
