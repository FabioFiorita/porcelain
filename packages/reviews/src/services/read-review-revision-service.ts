import { Context, Effect, Layer } from 'effect';
import type { Review } from '../models/review.ts';
import type { ReadReviewInput } from '../models/review-management.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class ReadReviewRevisionService extends Context.Service<
  ReadReviewRevisionService,
  {
    readonly execute: (
      input: ReadReviewInput,
    ) => Effect.Effect<Review, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/ReadReviewRevisionService') {
  static readonly layer = Layer.effect(
    ReadReviewRevisionService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('ReadReviewRevisionService.execute')(
          function* (input) {
            const review = yield* reviews.read(input);
            if (review === undefined) return yield* new ReviewNotFoundError();
            return review;
          },
        ),
      };
    }),
  );
}
