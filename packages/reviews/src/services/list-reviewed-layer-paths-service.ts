import type {
  ListReviewedLayerPathsInput,
  ListReviewedLayerPathsResult,
} from '../models/list-reviewed-layer-paths.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { markedLayers } from '../rules/reviewed-marks.ts';
import { reviewPaths } from '../rules/review-evidence.ts';

export class ListReviewedLayerPathsService {
  private readonly reviews: ReviewStore;
  private readonly reviewedLayers: ReviewedLayerStore;

  constructor(reviews: ReviewStore, reviewedLayers: ReviewedLayerStore) {
    this.reviews = reviews;
    this.reviewedLayers = reviewedLayers;
  }

  execute(input: ListReviewedLayerPathsInput): ListReviewedLayerPathsResult {
    const { worktreeId } = input;
    const layers = markedLayers(
      this.reviews.read({ worktreeId })?.layers ?? [],
      this.reviewedLayers.list({ worktreeId }),
    );
    return { paths: reviewPaths(layers, []) };
  }
}
