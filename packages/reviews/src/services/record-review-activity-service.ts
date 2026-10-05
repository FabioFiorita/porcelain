import { Effect, Context, Layer } from 'effect';
import {
  type RecordReviewActivityInput,
  type RecordReviewActivityResult,
} from '../models/record-review-activity.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { reviewActivity } from '../rules/review-activity.ts';

export class RecordReviewActivityService extends Context.Service<
  RecordReviewActivityService,
  {
    readonly execute: (
      input: RecordReviewActivityInput,
    ) => Effect.Effect<RecordReviewActivityResult, never>;
  }
>()('@porcelain/reviews/RecordReviewActivityService') {
  static readonly layer = Layer.effect(
    RecordReviewActivityService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;

      return {
        execute: Effect.fn('RecordReviewActivityService.execute')(function* (
          input: RecordReviewActivityInput,
        ): Effect.fn.Return<RecordReviewActivityResult, never> {
          return yield* Effect.sync<RecordReviewActivityResult>(() => {
            const { review } = input;
            const active = reviewActivity(review, input.evidence);
            if (active === review.active) return { changed: false };
            reviewsCapability.setActive({
              worktreeId: review.worktreeId,
              revision: review.revision,
              active,
            });
            return { changed: true };
          });
        }),
      };
    }),
  );
}
