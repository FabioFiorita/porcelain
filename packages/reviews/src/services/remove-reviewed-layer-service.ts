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
    this.reviewedLayers.remove({ worktreeId, layerId });
    return { worktreeId, marks: this.reviewedLayers.list({ worktreeId }) };
  }
}
