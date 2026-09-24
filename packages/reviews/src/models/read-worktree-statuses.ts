import type { WorktreeStatuses } from '@porcelain/kernel/models';

export type ReadWorktreeStatusesInput = { worktreeIds: string[] };

export type ReadWorktreeStatusesResult = { statuses: WorktreeStatuses };
