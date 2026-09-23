import type { ReviewedLayerMark } from '../models/reviewed-layer.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class ListReviewedLayersService {
  private readonly store: ReviewedLayerStore;

  constructor(store: ReviewedLayerStore) {
    this.store = store;
  }

  execute(worktreeId: string): {
    worktreeId: string;
    marks: ReviewedLayerMark[];
  } {
    return { worktreeId, marks: this.store.list(worktreeId) };
  }
}
