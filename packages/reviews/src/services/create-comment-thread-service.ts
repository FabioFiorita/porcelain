import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { CommentIdentityConflictError } from '../errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import type {
  CreateCommentThreadInput,
  CreateCommentThreadResult,
} from '../models/comment-operations.ts';
import type { CommentContent } from '../models/comment-thread.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  commentStorageSize,
  lastAgentRevision,
  repeatsCreation,
  threadFits,
} from '../rules/comment-threads.ts';

export class CreateCommentThreadService {
  private readonly commentStore: CommentStore;
  private readonly idSource: IdSource;
  private readonly clock: Clock;

  constructor(commentStore: CommentStore, idSource: IdSource, clock: Clock) {
    this.commentStore = commentStore;
    this.idSource = idSource;
    this.clock = clock;
  }

  execute(input: CreateCommentThreadInput): CreateCommentThreadResult {
    const threadId = input.threadId ?? this.idSource.next();
    const messageId = input.messageId ?? this.idSource.next();
    const author = commentAuthor(input.writer);
    const existing = this.commentStore.find(threadId);
    if (existing) {
      if (
        !repeatsCreation(existing, {
          worktreeId: input.worktreeId,
          anchor: input.anchor,
          messageId,
          body: input.body,
          author,
        })
      )
        throw new CommentIdentityConflictError();
      return existing;
    }
    if (this.commentStore.findMessage(messageId))
      throw new CommentIdentityConflictError();
    const content: CommentContent = {
      id: threadId,
      worktreeId: input.worktreeId,
      anchor: structuredClone(input.anchor),
      messages: [
        {
          id: messageId,
          body: input.body,
          author,
          createdAt: this.clock.now(),
        },
      ],
    };
    const sizeBytes = commentStorageSize(content);
    if (!threadFits(this.commentStore.usage(input.worktreeId), sizeBytes))
      throw new CommentLimitExceededError();
    const revision = this.commentStore.lastRevision() + 1;
    const thread = { ...content, resolved: false, revision };
    this.commentStore.insert(thread, {
      sizeBytes,
      lastAgentRevision: lastAgentRevision(author, revision),
    });
    return thread;
  }
}
