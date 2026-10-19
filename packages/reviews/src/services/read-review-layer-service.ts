import { Effect, Context, Layer } from 'effect';
import { ReviewLayerNotFoundError } from '../errors/review-layer-not-found-error.ts';
import {
  type ReadReviewLayerInput,
  type ReadReviewLayerResult,
} from '../models/read-review-layer.ts';
import { BranchReviewReader } from '../ports/branch-review-reader.ts';
import { reviewPaths } from '../rules/review-evidence.ts';

export class ReadReviewLayerService extends Context.Service<
  ReadReviewLayerService,
  {
    readonly execute: (
      input: ReadReviewLayerInput,
    ) => Effect.Effect<ReadReviewLayerResult, ReviewLayerNotFoundError>;
  }
>()('@porcelain/reviews/ReadReviewLayerService') {
  static readonly layer = Layer.effect(
    ReadReviewLayerService,
    Effect.gen(function* () {
      const reviewsCapability = yield* BranchReviewReader;

      return {
        execute: Effect.fn('ReadReviewLayerService.execute')(function* (
          input: ReadReviewLayerInput,
        ): Effect.fn.Return<ReadReviewLayerResult, ReviewLayerNotFoundError> {
          const review = yield* reviewsCapability.read({
            worktreeId: input.worktreeId,
          });
          const layer = review?.layers.find(
            (candidate) => candidate.id === input.layerId,
          );
          if (!layer || !review)
            return yield* Effect.fail(new ReviewLayerNotFoundError());
          return {
            reviewId: review.reviewId,
            layer,
            paths: reviewPaths([layer], []),
          };
        }),
      };
    }),
  );
}
