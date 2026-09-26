import type {
  RemoveReviewedLayerInput,
  RemoveReviewedLayerResult,
} from '../models/remove-reviewed-layer.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class RemoveReviewedLayerService {
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(reviewedLayers: ReviewedLayerStore) {
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: RemoveReviewedLayerInput): RemoveReviewedLayerResult {
    const { worktreeId, layerId } = input;
    const removed = this.reviewedLayers
      .list({ worktreeId })
      .some((mark) => mark.layerId === layerId);
    if (removed) this.reviewedLayers.remove({ worktreeId, layerId });
    return { removed };
  }
}
