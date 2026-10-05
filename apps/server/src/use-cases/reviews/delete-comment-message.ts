import {
  type CommentTargetNotFoundError,
  type CommentAuthorMismatchError,
} from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type CommentAuthor,
  type CommentThreadParams,
  type DeleteCommentMessageQuery,
  type DeleteCommentMessageResponse,
} from '@porcelain/contracts/reviews';
import { DeleteCommentMessageService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteCommentMessageUseCase extends Context.Service<
  DeleteCommentMessageUseCase,
  {
    readonly execute: (
      input: CommentThreadParams & DeleteCommentMessageQuery & CommentAuthor,
    ) => Effect.Effect<
      DeleteCommentMessageResponse,
      | WorktreeAccessFailure
      | CommentTargetNotFoundError
      | CommentAuthorMismatchError
    >;
  }
>()('@porcelain/server/DeleteCommentMessageUseCase') {
  static readonly layer = Layer.effect(
    DeleteCommentMessageUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const deleteCommentMessageCapability = yield* DeleteCommentMessageService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('DeleteCommentMessageUseCase.execute')(function* (
          input: CommentThreadParams &
            DeleteCommentMessageQuery &
            CommentAuthor,
        ): Effect.fn.Return<
          DeleteCommentMessageResponse,
          | WorktreeAccessFailure
          | CommentTargetNotFoundError
          | CommentAuthorMismatchError
        > {
          return yield* accessCapability.transaction(
            input.worktreeId,
            () => Effect.void,
            () => deleteCommentMessageCapability.execute(input),
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
