import { Effect } from 'effect';
import { CommentAuthorMismatchError } from '../errors/comment-author-mismatch-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import type {
  DeleteCommentMessageInput,
  DeleteCommentMessageResult,
} from '../models/delete-comment-message.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import { commentAuthor, commentStorageSize } from '../rules/comment-threads.ts';

export class DeleteCommentMessageService {
  private readonly comments: CommentStore;

  constructor(comments: CommentStore) {
    this.comments = comments;
  }

  execute(
    input: DeleteCommentMessageInput,
  ): Effect.Effect<
    DeleteCommentMessageResult,
    CommentTargetNotFoundError | CommentAuthorMismatchError
  > {
    return Effect.gen({ self: this }, function* () {
      const current = this.comments.find({ threadId: input.threadId });
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
        this.comments.remove({ threadId: current.id });
        return { threadId: current.id, thread: undefined };
      }
      return {
        threadId: current.id,
        thread: this.comments.removeMessage({
          thread: current,
          messageId: message.id,
          sizeBytes: commentStorageSize({ ...current, messages }),
        }),
      };
    });
  }
}
