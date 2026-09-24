import type { ProjectWorktrees } from './project-worktrees.ts';
import type { WorktreeStatuses } from './worktree-status.ts';

export type ReadWorktreeStatusesInput = { listings: ProjectWorktrees[] };

export type ReadWorktreeStatusesResult = WorktreeStatuses;
