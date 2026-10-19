import { type Effect, Context } from 'effect';
import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type { Review } from '../models/review.ts';

export interface BranchReviewReader {
  read(input: WorktreeKey): Effect.Effect<Review | undefined>;
  byWorktrees(input: WorktreeKeys): Effect.Effect<Review[]>;
}
export const BranchReviewReader = Context.Service<
  '@porcelain/reviews/BranchReviewReader',
  BranchReviewReader
>('@porcelain/reviews/BranchReviewReader');
