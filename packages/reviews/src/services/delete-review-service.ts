import { Context, Effect, Layer } from 'effect';
import { ReviewStore } from '../ports/review-store.ts';

export class DeleteReviewService extends Context.Service<
  DeleteReviewService,
  {
    readonly execute: (input: {
      reviewId: string;
    }) => Effect.Effect<{ deleted: boolean }>;
  }
>()('@porcelain/reviews/DeleteReviewService') {
  static readonly layer = Layer.effect(
    DeleteReviewService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('DeleteReviewService.execute')(function* (input: {
          reviewId: string;
        }) {
          return { deleted: yield* reviews.remove(input) };
        }),
      };
    }),
  );
}
