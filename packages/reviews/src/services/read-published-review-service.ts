import { Effect, Context, Layer } from 'effect';
import {
  type ReadPublishedReviewInput,
  type ReadPublishedReviewResult,
} from '../models/read-published-review.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class ReadPublishedReviewService extends Context.Service<
  ReadPublishedReviewService,
  {
    readonly execute: (
      input: ReadPublishedReviewInput,
    ) => Effect.Effect<ReadPublishedReviewResult, never>;
  }
>()('@porcelain/reviews/ReadPublishedReviewService') {
  static readonly layer = Layer.effect(
    ReadPublishedReviewService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;

      return {
        execute: Effect.fn('ReadPublishedReviewService.execute')(function* (
          input: ReadPublishedReviewInput,
        ): Effect.fn.Return<ReadPublishedReviewResult, never> {
          const review = yield* reviewsCapability.read({
            worktreeId: input.worktreeId,
          });
          return review ? { kind: 'published', review } : { kind: 'none' };
        }),
      };
    }),
  );
}
