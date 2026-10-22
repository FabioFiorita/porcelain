import { Context, Effect, Layer } from 'effect';
import type {
  ReviewNotFoundError,
  CommentTargetNotFoundError,
  CommentAuthorMismatchError,
  CommentLimitExceededError,
} from '@porcelain/reviews/errors';
import type {
  CommentThreadTargetParams,
  ReviewScope,
  EditCommentMessageRequest,
  EditCommentMessageResponse,
  CommentAuthor,
} from '@porcelain/contracts/reviews';
import {
  EditCommentMessageService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class EditCommentMessageUseCase extends Context.Service<
  EditCommentMessageUseCase,
  {
    readonly execute: (
      input: ReviewScope &
        EditCommentMessageRequest &
        CommentAuthor &
        CommentThreadTargetParams,
    ) => Effect.Effect<
      EditCommentMessageResponse,
      | WorktreeAccessFailure
      | ReviewNotFoundError
      | CommentTargetNotFoundError
      | CommentAuthorMismatchError
      | CommentLimitExceededError
    >;
  }
>()('@porcelain/server/EditCommentMessageUseCase') {
  static readonly layer = Layer.effect(
    EditCommentMessageUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const revisions = yield* ReadReviewRevisionService;
      const operation = yield* EditCommentMessageService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('EditCommentMessageUseCase.execute')(
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
