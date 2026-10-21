import { Context, type Effect } from 'effect';
import type {
  ReviewArchiveTarget,
  ReviewArchivePlan,
} from '../models/review-archive.ts';
import type { ReviewArchiveRefusedError } from '../errors/review-archive-refused-error.ts';
export interface ReviewArchiver {
  readonly execute: (
    input: ReviewArchiveTarget,
  ) => Effect.Effect<ReviewArchivePlan, ReviewArchiveRefusedError>;
}
export const ReviewArchiver = Context.Service<
  '@porcelain/reviews/ReviewArchiver',
  ReviewArchiver
>('@porcelain/reviews/ReviewArchiver');
