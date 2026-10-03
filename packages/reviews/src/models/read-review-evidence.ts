import type { LayerDraft } from './review.ts';

export type ReadReviewEvidenceInput = {
  worktreeId: string;
  layers: readonly Pick<LayerDraft, 'steps'>[];
};
