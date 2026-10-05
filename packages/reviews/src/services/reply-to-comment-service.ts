import { ReplyToCommentOptions } from '../ports/reply-to-comment-options.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock, IdSource } from '@porcelain/kernel/ports';
import { CommentIdentityConflictError } from '../errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import { type CommentMessage } from '../models/comment-thread.ts';
import {
  type ReplyToCommentInput,
  type ReplyToCommentResult,
} from '../models/reply-to-comment.ts';
import { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  commentStorageSize,
  repeatsReply,
  replyFits,
} from '../rules/comment-threads.ts';

export class ReplyToCommentService extends Context.Service<
  ReplyToCommentService,
  {
    readonly execute: (
      input: ReplyToCommentInput,
    ) => Effect.Effect<
      ReplyToCommentResult,
      | CommentIdentityConflictError
      | CommentTargetNotFoundError
      | CommentLimitExceededError
    >;
  }
>()('@porcelain/reviews/ReplyToCommentService') {
  static readonly layer = Layer.effect(
    ReplyToCommentService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;
      const idSourceCapability = yield* IdSource;
      const clockCapability = yield* Clock;
      const optionsCapability = yield* ReplyToCommentOptions;

      return {
        execute: Effect.fn('ReplyToCommentService.execute')(function* (
          input: ReplyToCommentInput,
        ): Effect.fn.Return<
          ReplyToCommentResult,
          | CommentIdentityConflictError
          | CommentTargetNotFoundError
          | CommentLimitExceededError
        > {
          const messageId = input.messageId ?? idSourceCapability.next();
          const author = commentAuthor(input.writer);
          const earlier = commentsCapability.findMessage({ messageId });
          const current = commentsCapability.find({ threadId: input.threadId });
          if (earlier) {
            if (
              !current ||
              !repeatsReply(earlier, {
                worktreeId: input.worktreeId,
                threadId: input.threadId,
                body: input.body,
                author,
              })
            )
              return yield* Effect.fail(new CommentIdentityConflictError());
            return current;
          }
          if (!current || current.worktreeId !== input.worktreeId)
            return yield* Effect.fail(new CommentTargetNotFoundError());
          const message: CommentMessage = {
            id: messageId,
            body: input.body,
            author,
            createdAt: clockCapability.now(),
          };
          const sizeBytes = commentStorageSize({
            ...current,
            messages: [...current.messages, message],
          });
          const usage = commentsCapability.usage({
            worktreeId: input.worktreeId,
          });
          if (!replyFits(current, usage, sizeBytes, optionsCapability))
            return yield* Effect.fail(new CommentLimitExceededError());
          return commentsCapability.append({
            thread: current,
            message,
            sizeBytes,
            writtenByAgent: author === 'agent',
          });
        }),
      };
    }),
  );
}
