import { Effect, Context, Layer } from 'effect';
import { CommentAuthorMismatchError } from '../errors/comment-author-mismatch-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import {
  type DeleteCommentMessageInput,
  type DeleteCommentMessageResult,
} from '../models/delete-comment-message.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { commentAuthor, commentStorageSize } from '../rules/comment-threads.ts';

export class DeleteCommentMessageService extends Context.Service<
  DeleteCommentMessageService,
  {
    readonly execute: (
      input: DeleteCommentMessageInput,
    ) => Effect.Effect<
      DeleteCommentMessageResult,
      CommentTargetNotFoundError | CommentAuthorMismatchError
    >;
  }
>()('@porcelain/reviews/DeleteCommentMessageService') {
  static readonly layer = Layer.effect(
    DeleteCommentMessageService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;

      return {
        execute: Effect.fn('DeleteCommentMessageService.execute')(function* (
          input: DeleteCommentMessageInput,
        ): Effect.fn.Return<
          DeleteCommentMessageResult,
          CommentTargetNotFoundError | CommentAuthorMismatchError
        > {
          const current = commentsCapability.find({ threadId: input.threadId });
          const message = current?.messages.find(
            (entry) => entry.id === input.messageId,
          );
          if (!current || !message || current.worktreeId !== input.worktreeId)
            return yield* Effect.fail(new CommentTargetNotFoundError());
          if (message.author !== commentAuthor(input.writer))
            return yield* Effect.fail(new CommentAuthorMismatchError());
          const messages = current.messages.filter(
            (entry) => entry.id !== message.id,
          );
          if (messages.length === 0) {
            commentsCapability.remove({ threadId: current.id });
            return { threadId: current.id, thread: undefined };
          }
          return {
            threadId: current.id,
            thread: commentsCapability.removeMessage({
              thread: current,
              messageId: message.id,
              sizeBytes: commentStorageSize({ ...current, messages }),
            }),
          };
        }),
      };
    }),
  );
}
