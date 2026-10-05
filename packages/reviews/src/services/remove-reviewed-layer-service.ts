import { Effect, Context, Layer } from 'effect';
import {
  type RemoveReviewedLayerInput,
  type RemoveReviewedLayerResult,
} from '../models/remove-reviewed-layer.ts';
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
      const reviewedLayersCapability = yield* ReviewedLayerStore;

      return {
        execute: Effect.fn('RemoveReviewedLayerService.execute')(function* (
          input: RemoveReviewedLayerInput,
        ): Effect.fn.Return<RemoveReviewedLayerResult, never> {
          return yield* Effect.sync<RemoveReviewedLayerResult>(() => {
            const { worktreeId, layerId } = input;
            const removed = reviewedLayersCapability
              .list({ worktreeId })
              .some((mark) => mark.layerId === layerId);
            if (removed)
              reviewedLayersCapability.remove({ worktreeId, layerId });
            return { removed };
          });
        }),
      };
    }),
  );
}
