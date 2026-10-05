import type { ReviewEvidence } from './review-evidence.ts';
import type { Review, ValidatedReviewDraft } from './review.ts';
import type { ProofFileReads } from './review-proof.ts';

export type PublishReviewInput = {
  worktreeId: string;
  draft: ValidatedReviewDraft;
  evidence: ReviewEvidence;
  proofFiles?: ProofFileReads | undefined;
};

export type PublishReviewResult = {
  review: Review;
  warnings: readonly SummaryStyleWarning[];
};

export type SummaryStyleWarning = 'missing-style';
