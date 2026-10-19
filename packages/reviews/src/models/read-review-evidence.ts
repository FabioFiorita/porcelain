import type { LayerDraft, ReviewCommit } from './review.ts';

export type ReadReviewEvidenceInput = {
  worktreeId: string;
  revision: ReviewCommit;
  layers: readonly Pick<LayerDraft, 'steps'>[];
};
