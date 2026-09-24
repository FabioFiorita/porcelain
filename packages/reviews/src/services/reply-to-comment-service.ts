import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { CommentIdentityConflictError } from '../errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import type {
  CommentLimits,
  CommentMessage,
} from '../models/comment-thread.ts';
import type {
  ReplyToCommentInput,
  ReplyToCommentResult,
} from '../models/reply-to-comment.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  commentStorageSize,
  repeatsReply,
  replyFits,
} from '../rules/comment-threads.ts';

export class ReplyToCommentService {
  private readonly comments: CommentStore;
  private readonly idSource: IdSource;
  private readonly clock: Clock;
  private readonly limits: CommentLimits;

  constructor(
    comments: CommentStore,
    idSource: IdSource,
    clock: Clock,
    limits: CommentLimits,
  ) {
    this.comments = comments;
    this.idSource = idSource;
    this.clock = clock;
    this.limits = limits;
  }

  execute(input: ReplyToCommentInput): ReplyToCommentResult {
    const messageId = input.messageId ?? this.idSource.next();
    const author = commentAuthor(input.writer);
    const earlier = this.comments.findMessage({ messageId });
    const current = this.comments.find({ threadId: input.threadId });
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
        throw new CommentIdentityConflictError();
      return current;
    }
    if (!current || current.worktreeId !== input.worktreeId)
      throw new CommentTargetNotFoundError();
    const message: CommentMessage = {
      id: messageId,
      body: input.body,
      author,
      createdAt: this.clock.now(),
    };
    const sizeBytes = commentStorageSize({
      ...current,
      messages: [...current.messages, message],
    });
    const usage = this.comments.usage({ worktreeId: input.worktreeId });
    if (!replyFits(current, usage, sizeBytes, this.limits))
      throw new CommentLimitExceededError();
    return this.comments.append({
      thread: current,
      message,
      sizeBytes,
      writtenByAgent: author === 'agent',
    });
  }
}
