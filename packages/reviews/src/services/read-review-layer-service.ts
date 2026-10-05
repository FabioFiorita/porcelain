import { Effect, Context, Layer } from 'effect';
import { ReviewLayerNotFoundError } from '../errors/review-layer-not-found-error.ts';
import {
  type ReadReviewLayerInput,
  type ReadReviewLayerResult,
} from '../models/read-review-layer.ts';
import { ReviewStore } from '../ports/review-store.ts';
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
      const reviewsCapability = yield* ReviewStore;

      return {
        execute: Effect.fn('ReadReviewLayerService.execute')(function* (
          input: ReadReviewLayerInput,
        ): Effect.fn.Return<ReadReviewLayerResult, ReviewLayerNotFoundError> {
          const layer = reviewsCapability
            .read({ worktreeId: input.worktreeId })
            ?.layers.find((candidate) => candidate.id === input.layerId);
          if (!layer) return yield* Effect.fail(new ReviewLayerNotFoundError());
          return { layer, paths: reviewPaths([layer], []) };
        }),
      };
    }),
  );
}
