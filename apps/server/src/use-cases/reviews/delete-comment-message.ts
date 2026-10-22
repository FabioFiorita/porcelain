import { Context, Effect, Layer } from 'effect';
import type {
  ReviewNotFoundError,
  CommentTargetNotFoundError,
  CommentAuthorMismatchError,
} from '@porcelain/reviews/errors';
import type {
  CommentThreadTargetParams,
  ReviewScope,
  DeleteCommentMessageQuery,
  DeleteCommentMessageResponse,
  CommentAuthor,
} from '@porcelain/contracts/reviews';
import {
  DeleteCommentMessageService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteCommentMessageUseCase extends Context.Service<
  DeleteCommentMessageUseCase,
  {
    readonly execute: (
      input: ReviewScope &
        DeleteCommentMessageQuery &
        CommentAuthor &
        CommentThreadTargetParams,
    ) => Effect.Effect<
      DeleteCommentMessageResponse,
      | WorktreeAccessFailure
      | ReviewNotFoundError
      | CommentTargetNotFoundError
      | CommentAuthorMismatchError
    >;
  }
>()('@porcelain/server/DeleteCommentMessageUseCase') {
  static readonly layer = Layer.effect(
    DeleteCommentMessageUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const revisions = yield* ReadReviewRevisionService;
      const operation = yield* DeleteCommentMessageService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('DeleteCommentMessageUseCase.execute')(
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
                    succeeded: (value) =>
                      events.worktreeChanged({
                        worktreeId: value.worktreeId,
                        change: 'comments',
                      }),
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
              () => events.worktreeChanged({ worktreeId, change: 'comments' }),
            );
            return result;
          },
        ),
      };
    }),
  );
}
