import type {
  ListReviewedLayersInput,
  ListReviewedLayersResult,
} from '../models/list-reviewed-layers.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { reviewedLayerMarks } from '../rules/reviewed-marks.ts';

export class ListReviewedLayersService {
  private readonly reviews: ReviewStore;
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(reviews: ReviewStore, reviewedLayers: ReviewedLayerStore) {
    this.reviews = reviews;
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: ListReviewedLayersInput): ListReviewedLayersResult {
    const { worktreeId } = input;
    return {
      worktreeId,
      marks: reviewedLayerMarks(
        this.reviewedLayers.list({ worktreeId }),
        this.reviews.read({ worktreeId })?.layers ?? [],
        input.texts,
      ),
    };
  }
}
