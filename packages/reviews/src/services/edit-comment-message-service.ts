import { EditCommentMessageOptions } from '../ports/edit-comment-message-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { CommentAuthorMismatchError } from '../errors/comment-author-mismatch-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import {
  type EditCommentMessageInput,
  type EditCommentMessageResult,
} from '../models/edit-comment-message.ts';
import { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  commentStorageSize,
  rewriteFits,
} from '../rules/comment-threads.ts';

export class EditCommentMessageService extends Context.Service<
  EditCommentMessageService,
  {
    readonly execute: (
      input: EditCommentMessageInput,
    ) => Effect.Effect<
      EditCommentMessageResult,
      | CommentTargetNotFoundError
      | CommentAuthorMismatchError
      | CommentLimitExceededError
    >;
  }
>()('@porcelain/reviews/EditCommentMessageService') {
  static readonly layer = Layer.effect(
    EditCommentMessageService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;
      const clockCapability = yield* Clock.Clock;
      const optionsCapability = yield* EditCommentMessageOptions;

      return {
        execute: Effect.fn('EditCommentMessageService.execute')(function* (
          input: EditCommentMessageInput,
        ): Effect.fn.Return<
          EditCommentMessageResult,
          | CommentTargetNotFoundError
          | CommentAuthorMismatchError
          | CommentLimitExceededError
        > {
          const current = yield* commentsCapability.find({
            threadId: input.threadId,
          });
          const message = current?.messages.find(
            (entry) => entry.id === input.messageId,
          );
          if (!current || !message || current.worktreeId !== input.worktreeId)
            return yield* Effect.fail(new CommentTargetNotFoundError());
          if (message.author !== commentAuthor(input.writer))
            return yield* Effect.fail(new CommentAuthorMismatchError());
          if (message.body === input.body)
            return { thread: current, changed: false };
          const editedAt = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
          );
          const sizeBytes = commentStorageSize({
            ...current,
            messages: current.messages.map((entry) =>
              entry.id === message.id
                ? { ...entry, body: input.body, editedAt }
                : entry,
            ),
          });
          const usage = yield* commentsCapability.usage({
            worktreeId: input.worktreeId,
          });
          if (
            !rewriteFits(
              current,
              usage,
              sizeBytes,
              optionsCapability.bytesPerWorktree,
            )
          )
            return yield* Effect.fail(new CommentLimitExceededError());
          return {
            thread: yield* commentsCapability.edit({
              thread: current,
              messageId: message.id,
              body: input.body,
              editedAt,
              sizeBytes,
            }),
            changed: true,
          };
        }),
      };
    }),
  );
}
