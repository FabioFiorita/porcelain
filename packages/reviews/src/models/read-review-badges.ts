import type { WorktreeStatuses } from '@porcelain/kernel/models';

export type ReadReviewBadgesInput = { worktreeIds: string[] };

export type ReadReviewBadgesResult = { statuses: WorktreeStatuses };
