import type {
  ReviewedLayerMark,
  SetReviewedLayerInput,
} from '../models/reviewed-layer.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class SetReviewedLayerService {
  private readonly store: ReviewedLayerStore;
  private readonly now: () => string;

  constructor(
    store: ReviewedLayerStore,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.now = now;
  }

  execute(
    worktreeId: string,
    input: SetReviewedLayerInput,
  ): { worktreeId: string; marks: ReviewedLayerMark[] } {
    this.store.set(worktreeId, {
      layerId: input.layerId,
      fingerprint: input.fingerprint,
      reviewedAt: this.now(),
    });
    return { worktreeId, marks: this.store.list(worktreeId) };
  }
}
