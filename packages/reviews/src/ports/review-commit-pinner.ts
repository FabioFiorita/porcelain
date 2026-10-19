import { Context, type Effect } from 'effect';
import type { ReviewPublishRefusedError } from '../errors/review-publish-refused-error.ts';

export interface ReviewCommitPinner {
  pin(input: {
    commonDirectory: string;
    reviewId: string;
    revision: number;
    headOid: string;
  }): Effect.Effect<void, ReviewPublishRefusedError>;
}
export const ReviewCommitPinner = Context.Service<
  '@porcelain/reviews/ReviewCommitPinner',
  ReviewCommitPinner
>('@porcelain/reviews/ReviewCommitPinner');
