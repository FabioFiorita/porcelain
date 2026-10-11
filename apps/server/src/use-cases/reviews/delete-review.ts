import { Context, Effect, Layer } from 'effect';
import { type DeleteReviewResponse } from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { DeleteReviewService } from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteReviewUseCase extends Context.Service<
  DeleteReviewUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<DeleteReviewResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/DeleteReviewUseCase') {
  static readonly layer = Layer.effect(
    DeleteReviewUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const remove = yield* DeleteReviewService;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('DeleteReviewUseCase.execute')(function* (
          input: WorktreeParams,
        ) {
          return yield* access.transaction(
            input.worktreeId,
            () => Effect.void,
            () => remove.execute(input),
            (result) =>
              result.deleted
                ? events.worktreeChanged({
                    worktreeId: input.worktreeId,
                    change: 'review',
                  })
                : Effect.void,
          );
        }),
      };
    }),
  );
}
