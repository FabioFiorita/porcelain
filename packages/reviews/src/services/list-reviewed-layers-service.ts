import type {
  ListReviewedLayersInput,
  ListReviewedLayersResult,
} from '../models/reviewed-mark.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class ListReviewedLayersService {
  private readonly reviewedLayerStore: ReviewedLayerStore;

  constructor(reviewedLayerStore: ReviewedLayerStore) {
    this.reviewedLayerStore = reviewedLayerStore;
  }

  execute(input: ListReviewedLayersInput): ListReviewedLayersResult {
    return {
      worktreeId: input.worktreeId,
      marks: this.reviewedLayerStore.list(input.worktreeId),
    };
  }
}
