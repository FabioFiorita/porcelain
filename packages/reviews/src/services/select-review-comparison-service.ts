import { Context, Effect, Layer } from 'effect';
import type {
  CompareReviewInput,
  ReviewComparisonSelection,
} from '../models/review-comparison.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { InvalidReviewComparisonError } from '../errors/invalid-review-comparison-error.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class SelectReviewComparisonService extends Context.Service<
  SelectReviewComparisonService,
  {
    readonly execute: (
      input: CompareReviewInput,
    ) => Effect.Effect<
      ReviewComparisonSelection,
      ReviewNotFoundError | InvalidReviewComparisonError
    >;
  }
>()('@porcelain/reviews/SelectReviewComparisonService') {
  static readonly layer = Layer.effect(
    SelectReviewComparisonService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('SelectReviewComparisonService.execute')(
          function* (input) {
            const record = yield* reviews.readRecord(input);
            if (record === undefined) return yield* new ReviewNotFoundError();
            const from = input.from ?? record.lastSeenRevision;
            const to = input.to ?? record.latestRevision;
            if (from > to) return yield* new InvalidReviewComparisonError();
            const next = yield* reviews.read({
              reviewId: input.reviewId,
              revision: to,
            });
            if (next === undefined) return yield* new ReviewNotFoundError();
            if (from === 0) return { from: undefined, to: next };
            const previous = yield* reviews.read({
              reviewId: input.reviewId,
              revision: from,
            });
            if (previous === undefined) return yield* new ReviewNotFoundError();
            return { from: previous, to: next };
          },
        ),
      };
    }),
  );
}
