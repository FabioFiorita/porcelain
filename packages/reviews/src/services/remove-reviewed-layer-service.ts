import type {
  RemoveReviewedLayerInput,
  RemoveReviewedLayerResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class RemoveReviewedLayerService {
  private readonly reviewedLayerStore: ReviewedLayerStore;

  constructor(reviewedLayerStore: ReviewedLayerStore) {
    this.reviewedLayerStore = reviewedLayerStore;
  }

  execute(input: RemoveReviewedLayerInput): RemoveReviewedLayerResult {
    this.reviewedLayerStore.remove(input.worktreeId, input.layerId);
    return {
      worktreeId: input.worktreeId,
      marks: this.reviewedLayerStore.list(input.worktreeId),
    };
  }
}
