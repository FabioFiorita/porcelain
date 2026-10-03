import { ReviewLayerNotFoundError } from '../errors/review-layer-not-found-error.ts';
import type {
  ReadReviewLayerInput,
  ReadReviewLayerResult,
} from '../models/read-review-layer.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import { reviewPaths } from '../rules/review-evidence.ts';

export class ReadReviewLayerService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(input: ReadReviewLayerInput): ReadReviewLayerResult {
    const layer = this.reviews
      .read({ worktreeId: input.worktreeId })
      ?.layers.find((candidate) => candidate.id === input.layerId);
    if (!layer) throw new ReviewLayerNotFoundError();
    return { layer, paths: reviewPaths([layer], []) };
  }
}
