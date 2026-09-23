import type { RegisteredProject } from './project.ts';
import type { ListableProject } from './worktree.ts';
import type { ProjectWorktrees } from './worktree-listing.ts';
import type { WorktreeStatuses } from './worktree-status.ts';

export type ListProjectWorktreesInput = { project: ListableProject };

export type UpdateProjectAvailabilityInput = { worktrees: ProjectWorktrees };

export type RecordWorktreePresenceInput = { worktrees: ProjectWorktrees };

export type ReadWorktreeStatusesInput = { listings: ProjectWorktrees[] };

export type ComposeInventoryInput = {
  listings: ProjectWorktrees[];
  statuses: WorktreeStatuses;
};

export type ComposeProjectReportInput = {
  project: Pick<RegisteredProject, 'id' | 'name'>;
  worktrees: ProjectWorktrees;
  statuses: WorktreeStatuses;
};

export type CollectAbsentWorktreesResult = { collected: string[] };
