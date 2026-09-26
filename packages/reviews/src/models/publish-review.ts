import type { ReviewEvidence } from './review-evidence.ts';
import type { Review, ReviewDraft } from './review.ts';

export type PublishReviewInput = {
  worktreeId: string;
  draft: ReviewDraft;
  evidence: ReviewEvidence;
};

export type PublishReviewResult = {
  review: Review;
  warnings: SummaryStyleWarning[];
};

export type SummaryStyleWarning = 'missing-style';
