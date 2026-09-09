import type { CommitReviewLayers } from '../../models/commit-review-layers.ts';
export interface CommitReviewLayerStore {
  read(projectId: string, commitOid: string): CommitReviewLayers | null;
  create(snapshot: CommitReviewLayers): CommitReviewLayers;
}
