import { Context, Effect, Exit, Layer } from 'effect';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type {
  ReviewScope,
  DeleteResolvedCommentsRequest,
  DeleteResolvedCommentsResponse,
  CommentAuthor,
} from '@porcelain/contracts/reviews';
import {
  DeleteResolvedCommentsService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteResolvedCommentsUseCase extends Context.Service<
  DeleteResolvedCommentsUseCase,
  {
    readonly execute: (
      input: ReviewScope & DeleteResolvedCommentsRequest & CommentAuthor,
    ) => Effect.Effect<
      DeleteResolvedCommentsResponse,
      WorktreeAccessFailure | ReviewNotFoundError
    >;
  }
>()('@porcelain/server/DeleteResolvedCommentsUseCase') {
  static readonly layer = Layer.effect(
    DeleteResolvedCommentsUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const revisions = yield* ReadReviewRevisionService;
      const operation = yield* DeleteResolvedCommentsService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('DeleteResolvedCommentsUseCase.execute')(
          function* (input) {
            if (input.reviewId !== undefined)
              return yield* lanes
                .run(
                  keys.reviews({ repositoryId: `review:${input.reviewId}` }),
                  'write',
                  () =>
                    Effect.gen(function* () {
                      const review = yield* revisions.execute({
                        reviewId: input.reviewId ?? '',
                        revision: undefined,
                      });
                      const result = yield* operation.execute({
                        ...input,
                        worktreeId: review.worktreeId,
                      });
                      return { result, worktreeId: review.worktreeId };
                    }),
                  {
                    settled: (exit) =>
                      Exit.isSuccess(exit) &&
                      exit.value.result.deleted.length > 0
                        ? events.worktreeChanged({
                            worktreeId: exit.value.worktreeId,
                            change: 'comments',
                          })
                        : Effect.void,
                  },
                )
                .pipe(
                  Effect.tap(() => events.inventoryChanged()),
                  Effect.map(({ result }) => result),
                );
            const worktreeId = input.worktreeId ?? '';
            const result = yield* access.transaction(
              worktreeId,
              () => Effect.void,
              () => operation.execute({ ...input, worktreeId }),
              (result) =>
                result.deleted.length > 0
                  ? events.worktreeChanged({ worktreeId, change: 'comments' })
                  : Effect.void,
            );
            return result;
          },
        ),
      };
    }),
  );
}
