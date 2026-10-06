import { Effect, Context, Layer } from 'effect';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import { type CheckReviewDraftInput } from '../models/check-review-draft.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class CheckReviewDraftService extends Context.Service<
  CheckReviewDraftService,
  {
    readonly execute: (
      input: CheckReviewDraftInput,
    ) => Effect.Effect<void, ReviewConflictError>;
  }
>()('@porcelain/reviews/CheckReviewDraftService') {
  static readonly layer = Layer.effect(
    CheckReviewDraftService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;

      return {
        execute: Effect.fn('CheckReviewDraftService.execute')(function* (
          input: CheckReviewDraftInput,
        ): Effect.fn.Return<void, ReviewConflictError> {
          const current = yield* reviewsCapability.read({
            worktreeId: input.worktreeId,
          });
          if ((current?.revision ?? 0) !== input.draft.expectedRevision)
            return yield* Effect.fail(new ReviewConflictError());
        }),
      };
    }),
  );
}
