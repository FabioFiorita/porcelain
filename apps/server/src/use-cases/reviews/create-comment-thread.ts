import { Context, Effect, Exit, Layer } from 'effect';
import type {
  ReviewNotFoundError,
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
  UnsupportedCommentComparisonError,
} from '@porcelain/reviews/errors';
import type { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type {
  ReviewScope,
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
  CommentAuthor,
} from '@porcelain/contracts/reviews';
import {
  CreateCommentThreadService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class CreateCommentThreadUseCase extends Context.Service<
  CreateCommentThreadUseCase,
  {
    readonly execute: (
      input: ReviewScope & CreateCommentThreadRequest & CommentAuthor,
    ) => Effect.Effect<
      CreateCommentThreadResponse,
      | WorktreeAccessFailure
      | ReviewNotFoundError
      | CommentIdentityConflictError
      | CommentLimitExceededError
      | CommentRevisionMismatchError
      | UnsupportedCommentComparisonError
      | InvalidLineRangeError
    >;
  }
>()('@porcelain/server/CreateCommentThreadUseCase') {
  static readonly layer = Layer.effect(
    CreateCommentThreadUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const revisions = yield* ReadReviewRevisionService;
      const operation = yield* CreateCommentThreadService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('CreateCommentThreadUseCase.execute')(
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
                        revision: input.reviewRevision,
                      });
                      const result = yield* operation.execute({
                        ...input,
                        worktreeId: review.worktreeId,
                        review: {
                          reviewId: review.reviewId,
                          revision: review.revision,
                          headOid: review.headOid,
                        },
                      });
                      return { result, worktreeId: review.worktreeId };
                    }),
                  {
                    settled: (exit) =>
                      Exit.isSuccess(exit)
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
              () => events.worktreeChanged({ worktreeId, change: 'comments' }),
            );
            return result;
          },
        ),
      };
    }),
  );
}
