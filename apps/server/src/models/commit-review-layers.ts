import type { ReviewLayer } from './review-layers.ts';

export type CommitReviewLayerRequest = {
  sourceWorktreeId: string;
  sourceRevision: number;
  parentNumber: number;
  references: ReviewLayer['files'];
};
export type CommitReviewLayers = {
  projectId: string;
  commitOid: string;
  sourceWorktreeId: string;
  sourceRevision: number;
  parentNumber: number;
  layers: ReviewLayer[];
};
