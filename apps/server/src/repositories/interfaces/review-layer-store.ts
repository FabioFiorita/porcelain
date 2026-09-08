import type { ReviewLayer, ReviewLayers } from '../../models/review-layers.ts';
export interface ReviewLayerStore {
  read(worktreeId: string): ReviewLayers;
  replace(
    worktreeId: string,
    expectedRevision: number,
    layers: ReviewLayer[],
  ): ReviewLayers;
}
