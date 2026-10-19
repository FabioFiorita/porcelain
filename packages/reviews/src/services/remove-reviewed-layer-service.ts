import { reviewedLayerMarks } from '../rules/reviewed-marks.ts';
import { Effect, Context, Layer } from 'effect';
import {
  type RemoveReviewedLayerInput,
  type RemoveReviewedLayerResult,
} from '../models/remove-reviewed-layer.ts';
import { BranchReviewReader } from '../ports/branch-review-reader.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class RemoveReviewedLayerService extends Context.Service<
  RemoveReviewedLayerService,
  {
    readonly execute: (
      input: RemoveReviewedLayerInput,
    ) => Effect.Effect<RemoveReviewedLayerResult, never>;
  }
>()('@porcelain/reviews/RemoveReviewedLayerService') {
  static readonly layer = Layer.effect(
    RemoveReviewedLayerService,
    Effect.gen(function* () {
      const reviews = yield* BranchReviewReader;
      const reviewedLayersCapability = yield* ReviewedLayerStore;

      return {
        execute: Effect.fn('RemoveReviewedLayerService.execute')(function* (
          input: RemoveReviewedLayerInput,
        ): Effect.fn.Return<RemoveReviewedLayerResult, never> {
          const { worktreeId, layerId } = input;
          const review = yield* reviews.read({ worktreeId });
          if (review === undefined) return { removed: false };
          const reviewId = review.reviewId;
          const mark = reviewedLayerMarks(
            yield* reviewedLayersCapability.list({ reviewId }),
            review.layers,
          ).find((mark) => mark.layerId === layerId);
          if (mark !== undefined)
            yield* reviewedLayersCapability.remove({
              reviewId,
              layerId,
              fingerprint: mark.fingerprint,
            });
          const removed = mark !== undefined;
          return { removed };
        }),
      };
    }),
  );
}
