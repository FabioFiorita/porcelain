import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import {
  type SetReviewedLayerInput,
  type SetReviewedLayerResult,
} from '../models/set-reviewed-layer.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { currentLayerFingerprint } from '../rules/resolve-review.ts';

export class SetReviewedLayerService extends Context.Service<
  SetReviewedLayerService,
  {
    readonly execute: (
      input: SetReviewedLayerInput,
    ) => Effect.Effect<SetReviewedLayerResult, ReviewedMarkConflictError>;
  }
>()('@porcelain/reviews/SetReviewedLayerService') {
  static readonly layer = Layer.effect(
    SetReviewedLayerService,
    Effect.gen(function* () {
      const reviewedLayersCapability = yield* ReviewedLayerStore;
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('SetReviewedLayerService.execute')(function* (
          input: SetReviewedLayerInput,
        ): Effect.fn.Return<SetReviewedLayerResult, ReviewedMarkConflictError> {
          const { worktreeId, layer, fingerprint } = input;
          if (currentLayerFingerprint(layer, input.texts) !== fingerprint)
            return yield* Effect.fail(new ReviewedMarkConflictError());
          const mark = {
            layerId: layer.id,
            fingerprint,
            reviewedAt: clockCapability.now(),
          };
          reviewedLayersCapability.save({ worktreeId, marks: [mark] });
          return mark;
        }),
      };
    }),
  );
}
