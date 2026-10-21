import { type Effect, Context } from 'effect';
import type {
  Review,
  ReviewRecord,
  ReviewKey,
  BranchReviewKey,
  ReviewSave,
  ReviewSummary,
  ReviewSummaryKey,
} from '../models/review.ts';
import type { ProofFile } from '../models/review-proof.ts';
import type { ReviewConflictError } from '../errors/review-conflict-error.ts';

export interface ReviewStore {
  read(input: ReviewKey): Effect.Effect<Review | undefined>;
  readRecord(input: {
    reviewId: string;
  }): Effect.Effect<ReviewRecord | undefined>;
  findOpen(input: BranchReviewKey): Effect.Effect<ReviewRecord | undefined>;
  list(input: { projectId: string }): Effect.Effect<ReviewRecord[]>;
  listRevisions(input: { reviewId: string }): Effect.Effect<Review[]>;
  findSummary(
    input: ReviewSummaryKey,
  ): Effect.Effect<ReviewSummary | undefined>;
  remove(input: { reviewId: string }): Effect.Effect<boolean>;
  save(
    input: ReviewSave & { record: ReviewRecord; expectedRevision: number },
  ): Effect.Effect<void, ReviewConflictError>;
  readProofFile(input: {
    reviewId: string;
    revision?: number | undefined;
    proofId: string;
  }): Effect.Effect<ProofFile | undefined>;
  setState(input: {
    reviewId: string;
    state: 'open' | 'closed';
  }): Effect.Effect<void>;
  archive(input: { reviewId: string }): Effect.Effect<void>;
  markSeen(input: { reviewId: string; revision: number }): Effect.Effect<void>;
}
export const ReviewStore = Context.Service<
  '@porcelain/reviews/ReviewStore',
  ReviewStore
>('@porcelain/reviews/ReviewStore');
