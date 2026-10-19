import { Context, Effect, Layer } from 'effect';

import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class SetReviewStateService extends Context.Service<
  SetReviewStateService,
  {
    readonly execute: (input: {
      reviewId: string;
      state: 'closed';
    }) => Effect.Effect<{ updated: boolean }, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/SetReviewStateService') {
  static readonly layer = Layer.effect(
    SetReviewStateService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('SetReviewStateService.execute')(function* (input) {
          if ((yield* reviews.readRecord(input)) === undefined)
            return yield* new ReviewNotFoundError();
          yield* reviews.setState(input);
          return { updated: true };
        }),
      };
    }),
  );
}
