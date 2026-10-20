import { Context, Effect, Layer } from 'effect';
import type { ReviewRecord } from '../models/review.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
export class ReadReviewRecordService extends Context.Service<
  ReadReviewRecordService,
  {
    readonly execute: (input: {
      reviewId: string;
    }) => Effect.Effect<ReviewRecord, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/ReadReviewRecordService') {
  static readonly layer = Layer.effect(
    ReadReviewRecordService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('ReadReviewRecordService.execute')(
          function* (input) {
            const record = yield* reviews.readRecord(input);
            if (record === undefined) return yield* new ReviewNotFoundError();
            return record;
          },
        ),
      };
    }),
  );
}
