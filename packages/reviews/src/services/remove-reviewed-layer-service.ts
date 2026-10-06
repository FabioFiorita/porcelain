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
          const { worktreeId, layerId } = input;
          const removed = (yield* reviewedLayersCapability.list({
            worktreeId,
          })).some((mark) => mark.layerId === layerId);
          if (removed)
            yield* reviewedLayersCapability.remove({ worktreeId, layerId });
          return { removed };
        }),
      };
    }),
  );
}
