import type { CommitReviewLayers } from '../../models/commit-review-layers.ts';
export interface CommitReviewLayerStore {
  complete(
    snapshot: CommitReviewLayers,
    remaining: CommitReviewLayers['layers'],
  ): void;
  read(projectId: string, commitOid: string): CommitReviewLayers | null;
  create(snapshot: CommitReviewLayers): CommitReviewLayers;
}
