import { ReadPublishedReviewService } from '@porcelain/reviews/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Context, Effect, Exit, Layer } from 'effect';
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
      input: WorktreeParams | { reviewId: string },
    ) => Effect.Effect<DeleteReviewResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/DeleteReviewUseCase') {
  static readonly layer = Layer.effect(
    DeleteReviewUseCase,
    Effect.gen(function* () {
      const branches = yield* ReadPublishedReviewService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const access = yield* WorktreeAccess;
      const remove = yield* DeleteReviewService;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('DeleteReviewUseCase.execute')(function* (
          input: WorktreeParams | { reviewId: string },
        ) {
          if ('reviewId' in input)
            return yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'write',
              () => remove.execute(input),
              {
                settled: (exit) =>
                  Exit.isSuccess(exit)
                    ? events.inventoryChanged()
                    : Effect.void,
              },
            );
          const worktreeId = input.worktreeId;
          return yield* access.transaction(
            worktreeId,
            () => Effect.void,
            () =>
              Effect.gen(function* () {
                const review = yield* branches.execute({ worktreeId });
                return review.kind === 'none'
                  ? { deleted: false }
                  : yield* remove.execute({ reviewId: review.review.reviewId });
              }),
            (result) =>
              result.deleted
                ? Effect.andThen(
                    events.worktreeChanged({ worktreeId, change: 'review' }),
                    events.inventoryChanged(),
                  )
                : Effect.void,
          );
        }),
      };
    }),
  );
}
