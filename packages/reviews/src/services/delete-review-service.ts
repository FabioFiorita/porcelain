import { Context, Effect, Layer } from 'effect';
import { type WorktreeKey } from '@porcelain/kernel/models';
import { ReviewStore } from '../ports/review-store.ts';

export class DeleteReviewService extends Context.Service<
  DeleteReviewService,
  {
    readonly execute: (
      input: WorktreeKey,
    ) => Effect.Effect<{ deleted: boolean }>;
  }
>()('@porcelain/reviews/DeleteReviewService') {
  static readonly layer = Layer.effect(
    DeleteReviewService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('DeleteReviewService.execute')(function* (
          input: WorktreeKey,
        ) {
          return { deleted: yield* reviews.remove(input) };
        }),
      };
    }),
  );
}
