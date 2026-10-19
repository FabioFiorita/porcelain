import { Context, Effect, Layer } from 'effect';
import type {
  ReviewNotFoundError,
  CommentTargetNotFoundError,
} from '@porcelain/reviews/errors';
import type {
  ReviewScope,
  UpdateCommentThreadRequest,
  UpdateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import {
  UpdateCommentThreadService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class UpdateCommentThreadUseCase extends Context.Service<
  UpdateCommentThreadUseCase,
  {
    readonly execute: (
      input: ReviewScope & UpdateCommentThreadRequest & { threadId: string },
    ) => Effect.Effect<
      UpdateCommentThreadResponse,
      WorktreeAccessFailure | ReviewNotFoundError | CommentTargetNotFoundError
    >;
  }
>()('@porcelain/server/UpdateCommentThreadUseCase') {
  static readonly layer = Layer.effect(
    UpdateCommentThreadUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const revisions = yield* ReadReviewRevisionService;
      const operation = yield* UpdateCommentThreadService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('UpdateCommentThreadUseCase.execute')(
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
                      if (result.changed)
                        yield* events.worktreeChanged({
                          worktreeId: review.worktreeId,
                          change: 'comments',
                        });
                      return result.thread;
                    }),
                )
                .pipe(Effect.tap(() => events.inventoryChanged()));
            const worktreeId = input.worktreeId ?? '';
            const result = yield* access.transaction(
              worktreeId,
              () => Effect.void,
              () => operation.execute({ ...input, worktreeId }),
              (result) =>
                result.changed
                  ? events.worktreeChanged({ worktreeId, change: 'comments' })
                  : Effect.void,
            );
            return result.thread;
          },
        ),
      };
    }),
  );
}
