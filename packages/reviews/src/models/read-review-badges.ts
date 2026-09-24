import type { ReviewBadges } from '@porcelain/kernel/models';
import type { ReviewTexts } from './review-evidence.ts';

export type ReadReviewBadgesInput = {
  worktreeIds: string[];
  texts: ReadonlyMap<string, ReviewTexts>;
};

export type ReadReviewBadgesResult = { statuses: ReviewBadges };
