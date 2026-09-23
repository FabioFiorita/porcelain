import type { ReviewedLayerMark } from '../models/reviewed-layer.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class RemoveReviewedLayerService {
  private readonly store: ReviewedLayerStore;

  constructor(store: ReviewedLayerStore) {
    this.store = store;
  }

  execute(
    worktreeId: string,
    layerId: string,
  ): { worktreeId: string; marks: ReviewedLayerMark[] } {
    this.store.remove(worktreeId, layerId);
    return { worktreeId, marks: this.store.list(worktreeId) };
  }
}
