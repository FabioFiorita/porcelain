import { Effect } from 'effect';
import type { Clock } from '@porcelain/kernel/ports';
import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import type {
  SetReviewedLayerInput,
  SetReviewedLayerResult,
} from '../models/set-reviewed-layer.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { currentLayerFingerprint } from '../rules/resolve-review.ts';

export class SetReviewedLayerService {
  private readonly reviewedLayers: ReviewedLayerStore;
  private readonly clock: Clock;

  constructor(reviewedLayers: ReviewedLayerStore, clock: Clock) {
    this.reviewedLayers = reviewedLayers;
    this.clock = clock;
  }

  execute(
    input: SetReviewedLayerInput,
  ): Effect.Effect<SetReviewedLayerResult, ReviewedMarkConflictError> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId, layer, fingerprint } = input;
      if (currentLayerFingerprint(layer, input.texts) !== fingerprint)
        return yield* Effect.fail(new ReviewedMarkConflictError());
      const mark = {
        layerId: layer.id,
        fingerprint,
        reviewedAt: this.clock.now(),
      };
      this.reviewedLayers.save({ worktreeId, marks: [mark] });
      return mark;
    });
  }
}
