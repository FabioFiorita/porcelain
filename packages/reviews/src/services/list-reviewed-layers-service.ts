import type {
  ListReviewedLayersInput,
  ListReviewedLayersResult,
} from '../models/list-reviewed-layers.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class ListReviewedLayersService {
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(reviewedLayers: ReviewedLayerStore) {
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: ListReviewedLayersInput): ListReviewedLayersResult {
    const { worktreeId } = input;
    return { worktreeId, marks: this.reviewedLayers.list({ worktreeId }) };
  }
}
