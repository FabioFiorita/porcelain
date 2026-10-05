import {
  type CommentTargetNotFoundError,
  type CommentAuthorMismatchError,
  type CommentLimitExceededError,
} from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type CommentAuthor,
  type CommentThreadParams,
  type EditCommentMessageRequest,
  type EditCommentMessageResponse,
} from '@porcelain/contracts/reviews';
import { EditCommentMessageService } from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';

export class EditCommentMessageUseCase extends Context.Service<
  EditCommentMessageUseCase,
  {
    readonly execute: (
      input: CommentThreadParams & EditCommentMessageRequest & CommentAuthor,
    ) => Effect.Effect<
      EditCommentMessageResponse,
      | WorktreeAccessFailure
      | CommentTargetNotFoundError
      | CommentAuthorMismatchError
      | CommentLimitExceededError
    >;
  }
>()('@porcelain/server/EditCommentMessageUseCase') {
  static readonly layer = Layer.effect(
    EditCommentMessageUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const editCommentMessageCapability = yield* EditCommentMessageService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('EditCommentMessageUseCase.execute')(function* (
          input: CommentThreadParams &
            EditCommentMessageRequest &
            CommentAuthor,
        ): Effect.fn.Return<
          EditCommentMessageResponse,
          | WorktreeAccessFailure
          | CommentTargetNotFoundError
          | CommentAuthorMismatchError
          | CommentLimitExceededError
        > {
          return yield* accessCapability
            .transaction(
              input.worktreeId,
              () => Effect.void,
              () => editCommentMessageCapability.execute(input),
              (value) =>
                Effect.sync(() => {
                  if (value.changed)
                    eventsCapability.worktreeChanged({
                      worktreeId: input.worktreeId,
                      change: 'comments',
                    });
                }),
            )
            .pipe(Effect.map((value) => value.thread));
        }),
      };
    }),
  );
}
