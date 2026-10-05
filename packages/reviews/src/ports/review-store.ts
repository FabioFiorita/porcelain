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
  read(input: WorktreeKey): Review | undefined;
  byWorktrees(input: WorktreeKeys): Review[];
  findSummary(input: ReviewSummaryKey): ReviewSummary | undefined;
  save(input: ReviewSave): void;
  readProofFile(input: ProofFileKey): ProofFile | undefined;
  setActive(input: ReviewActivity): void;
}

export const ReviewStore = Context.Service<
  '@porcelain/reviews/ReviewStore',
  ReviewStore
>('@porcelain/reviews/ReviewStore');
