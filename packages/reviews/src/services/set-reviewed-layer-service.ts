import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import type {
  SetReviewedLayerInput,
  SetReviewedLayerResult,
} from '../models/reviewed-mark.ts';
import type { Clock } from '../ports/clock.ts';
import type { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { currentLayerFingerprint } from '../rules/resolve-review.ts';

export class SetReviewedLayerService {
  private readonly reviewedLayerStore: ReviewedLayerStore;
  private readonly clock: Clock;

  constructor(reviewedLayerStore: ReviewedLayerStore, clock: Clock) {
    this.reviewedLayerStore = reviewedLayerStore;
    this.clock = clock;
  }

  execute(input: SetReviewedLayerInput): SetReviewedLayerResult {
    const layer = input.review?.layers.find(
      (candidate) => candidate.id === input.layerId,
    );
    if (
      !layer ||
      currentLayerFingerprint(layer, input.files) !== input.fingerprint
    )
      throw new ReviewedMarkConflictError();
    this.reviewedLayerStore.save(input.worktreeId, {
      layerId: input.layerId,
      fingerprint: input.fingerprint,
      reviewedAt: this.clock.now(),
      stale: false,
    });
    return {
      worktreeId: input.worktreeId,
      marks: this.reviewedLayerStore.list(input.worktreeId),
    };
  }
}
