import { Effect, Context, Layer, Ref } from 'effect';
import {
  type RecordReviewActivityInput,
  type RecordReviewActivityResult,
} from '../models/record-review-activity.ts';

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
      const observations = yield* Ref.make<
        ReadonlyMap<
          string,
          { reviewId: string; revision: number; active: boolean }
        >
      >(new Map());

      return {
        execute: Effect.fn('RecordReviewActivityService.execute')(function* (
          input: RecordReviewActivityInput,
        ): Effect.fn.Return<RecordReviewActivityResult, never> {
          const { review } = input;
          const key = review.worktreeId;
          const active = input.evidence.headOid === review.headOid;
          const previous = (yield* Ref.get(observations)).get(key);
          yield* Ref.update(observations, (current) =>
            new Map(current).set(key, {
              reviewId: review.reviewId,
              revision: review.revision,
              active,
            }),
          );
          return {
            changed:
              previous?.reviewId === review.reviewId &&
              previous.revision === review.revision &&
              previous.active !== active,
          };
        }),
      };
    }),
  );
}
