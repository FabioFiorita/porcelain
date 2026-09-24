import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { CommentIdentityConflictError } from '../errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import type {
  ReplyToCommentInput,
  ReplyToCommentResult,
} from '../models/comment-operations.ts';
import type { CommentMessage } from '../models/comment-thread.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  commentStorageSize,
  lastAgentRevision,
  repeatsReply,
  replyFits,
} from '../rules/comment-threads.ts';

export class ReplyToCommentService {
  private readonly commentStore: CommentStore;
  private readonly idSource: IdSource;
  private readonly clock: Clock;

  constructor(commentStore: CommentStore, idSource: IdSource, clock: Clock) {
    this.commentStore = commentStore;
    this.idSource = idSource;
    this.clock = clock;
  }

  execute(input: ReplyToCommentInput): ReplyToCommentResult {
    const messageId = input.messageId ?? this.idSource.next();
    const author = commentAuthor(input.writer);
    const earlier = this.commentStore.findMessage(messageId);
    if (earlier) {
      const thread = this.commentStore.find(input.threadId);
      if (
        !thread ||
        !repeatsReply(earlier, {
          worktreeId: input.worktreeId,
          threadId: input.threadId,
          body: input.body,
          author,
        })
      )
        throw new CommentIdentityConflictError();
      return thread;
    }
    const current = this.commentStore.find(input.threadId);
    if (!current || current.worktreeId !== input.worktreeId)
      throw new CommentTargetNotFoundError();
    const message: CommentMessage = {
      id: messageId,
      body: input.body,
      author,
      createdAt: this.clock.now(),
    };
    const messages = [...current.messages, message];
    const sizeBytes = commentStorageSize({ ...current, messages });
    if (
      !replyFits(current, this.commentStore.usage(input.worktreeId), sizeBytes)
    )
      throw new CommentLimitExceededError();
    const revision = this.commentStore.lastRevision() + 1;
    this.commentStore.append(current.worktreeId, current.id, message, {
      revision,
      sizeBytes,
      lastAgentRevision: lastAgentRevision(author, revision),
    });
    return { ...current, messages, revision };
  }
}
