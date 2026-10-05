import {
  type CommentIdentityConflictError,
  type CommentTargetNotFoundError,
  type CommentLimitExceededError,
} from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type CommentAuthor,
  type CommentThreadParams,
  type ReplyToCommentRequest,
  type ReplyToCommentResponse,
} from '@porcelain/contracts/reviews';
import { ReplyToCommentService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class ReplyToCommentUseCase extends Context.Service<
  ReplyToCommentUseCase,
  {
    readonly execute: (
      input: CommentThreadParams & ReplyToCommentRequest & CommentAuthor,
    ) => Effect.Effect<
      ReplyToCommentResponse,
      | WorktreeAccessFailure
      | CommentIdentityConflictError
      | CommentTargetNotFoundError
      | CommentLimitExceededError
    >;
  }
>()('@porcelain/server/ReplyToCommentUseCase') {
  static readonly layer = Layer.effect(
    ReplyToCommentUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const replyToCommentCapability = yield* ReplyToCommentService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('ReplyToCommentUseCase.execute')(function* (
          input: CommentThreadParams & ReplyToCommentRequest & CommentAuthor,
        ): Effect.fn.Return<
          ReplyToCommentResponse,
          | WorktreeAccessFailure
          | CommentIdentityConflictError
          | CommentTargetNotFoundError
          | CommentLimitExceededError
        > {
          return yield* accessCapability.transaction(
            input.worktreeId,
            () => Effect.void,
            () => replyToCommentCapability.execute(input),
            () =>
              Effect.sync(() => {
                eventsCapability.worktreeChanged({
                  worktreeId: input.worktreeId,
                  change: 'comments',
                });
              }),
          );
        }),
      };
    }),
  );
}
