import type { ReviewEvidence } from './review-evidence.ts';
import type { LayerDraft } from './review.ts';

export type ReadReviewEvidenceInput = {
  worktreeId: string;
  layers: readonly Pick<LayerDraft, 'steps'>[];
};

export type ReadReviewEvidenceResult = ReviewEvidence;
