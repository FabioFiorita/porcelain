import { Effect } from 'effect';
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

  execute(
    input: ReadReviewLayerInput,
  ): Effect.Effect<ReadReviewLayerResult, ReviewLayerNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      const layer = this.reviews
        .read({ worktreeId: input.worktreeId })
        ?.layers.find((candidate) => candidate.id === input.layerId);
      if (!layer) return yield* Effect.fail(new ReviewLayerNotFoundError());
      return { layer, paths: reviewPaths([layer], []) };
    });
  }
}
