import type { Review } from './review.ts';

export type ReadPublishedReviewInput = {
  worktreeId: string;
};

export type ReadPublishedReviewResult =
  | { kind: 'published'; review: Review }
  | { kind: 'none' };
