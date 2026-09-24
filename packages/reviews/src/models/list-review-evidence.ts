import type { FileChange, TrackedComparison } from '@porcelain/kernel/models';
import type { LayerDraft } from './review.ts';

export type ListReviewEvidenceInput = {
  layers: readonly Pick<LayerDraft, 'steps'>[];
  changes: readonly FileChange[];
};

export type ListReviewEvidenceResult = {
  paths: string[];
  comparisons: TrackedComparison[];
};
