import type { ReviewLayer } from '../models/review-layers.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
export class ReplaceReviewLayers {
  private readonly store: ReviewLayerStore;
  constructor(store: ReviewLayerStore) {
    this.store = store;
  }
  execute(worktreeId: string, expectedRevision: number, layers: ReviewLayer[]) {
    return this.store.replace(worktreeId, expectedRevision, layers);
  }
}
