import type { Effect } from 'effect';
import { Context } from 'effect';
import { type WorktreeKey, type WorktreeKeys } from '@porcelain/kernel/models';
import { type ProofFile, type ProofFileKey } from '../models/review-proof.ts';
import {
  type Review,
  type ReviewActivity,
  type ReviewSave,
  type ReviewSummary,
  type ReviewSummaryKey,
} from '../models/review.ts';

export interface ReviewStore {
  read(input: WorktreeKey): Effect.Effect<Review | undefined>;
  byWorktrees(input: WorktreeKeys): Effect.Effect<Review[]>;
  findSummary(
    input: ReviewSummaryKey,
  ): Effect.Effect<ReviewSummary | undefined>;
  save(input: ReviewSave): Effect.Effect<void>;
  readProofFile(input: ProofFileKey): Effect.Effect<ProofFile | undefined>;
  setActive(input: ReviewActivity): Effect.Effect<void>;
}

export const ReviewStore = Context.Service<
  '@porcelain/reviews/ReviewStore',
  ReviewStore
>('@porcelain/reviews/ReviewStore');
