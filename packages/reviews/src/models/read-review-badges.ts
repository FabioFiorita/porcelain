import type { ReviewBadges } from '@porcelain/kernel/models';

export type ReadReviewBadgesInput = {
  worktreeIds: readonly string[];
};

export type ReadReviewBadgesResult = { statuses: ReviewBadges };
