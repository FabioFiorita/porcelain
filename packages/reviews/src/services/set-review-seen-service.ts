import { Context, Effect, Layer } from 'effect';

import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class SetReviewSeenService extends Context.Service<
  SetReviewSeenService,
  {
    readonly execute: (input: {
      reviewId: string;
      revision: number;
    }) => Effect.Effect<{ updated: boolean }, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/SetReviewSeenService') {
  static readonly layer = Layer.effect(
    SetReviewSeenService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('SetReviewSeenService.execute')(function* (input) {
          if ((yield* reviews.read(input)) === undefined)
            return yield* new ReviewNotFoundError();
          yield* reviews.markSeen(input);
          return { updated: true };
        }),
      };
    }),
  );
}
