import type { Clock } from '@porcelain/kernel/ports';
import { CommentAuthorMismatchError } from '../errors/comment-author-mismatch-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import type {
  EditCommentMessageInput,
  EditCommentMessageOptions,
  EditCommentMessageResult,
} from '../models/edit-comment-message.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  commentStorageSize,
  rewriteFits,
} from '../rules/comment-threads.ts';

export class EditCommentMessageService {
  private readonly comments: CommentStore;
  private readonly clock: Clock;
  private readonly options: EditCommentMessageOptions;

  constructor(
    comments: CommentStore,
    clock: Clock,
    options: EditCommentMessageOptions,
  ) {
    this.comments = comments;
    this.clock = clock;
    this.options = options;
  }

  execute(input: EditCommentMessageInput): EditCommentMessageResult {
    const current = this.comments.find({ threadId: input.threadId });
    const message = current?.messages.find(
      (entry) => entry.id === input.messageId,
    );
    if (!current || !message || current.worktreeId !== input.worktreeId)
      throw new CommentTargetNotFoundError();
    if (message.author !== commentAuthor(input.writer))
      throw new CommentAuthorMismatchError();
    if (message.body === input.body) return { thread: current, changed: false };
    const editedAt = this.clock.now();
    const sizeBytes = commentStorageSize({
      ...current,
      messages: current.messages.map((entry) =>
        entry.id === message.id
          ? { ...entry, body: input.body, editedAt }
          : entry,
      ),
    });
    const usage = this.comments.usage({ worktreeId: input.worktreeId });
    if (!rewriteFits(current, usage, sizeBytes, this.options.bytesPerWorktree))
      throw new CommentLimitExceededError();
    return {
      thread: this.comments.edit({
        thread: current,
        messageId: message.id,
        body: input.body,
        editedAt,
        sizeBytes,
      }),
      changed: true,
    };
  }
}
