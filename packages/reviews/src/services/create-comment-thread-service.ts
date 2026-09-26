import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { CommentIdentityConflictError } from '../errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../errors/comment-limit-exceeded-error.ts';
import { CommentRevisionMismatchError } from '../errors/comment-revision-mismatch-error.ts';
import type {
  CommentAnchorProblem,
  CommentContent,
} from '../models/comment-thread.ts';
import type {
  CreateCommentThreadInput,
  CreateCommentThreadOptions,
  CreateCommentThreadResult,
} from '../models/create-comment-thread.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import {
  commentAnchorProblem,
  commentAuthor,
  commentStorageSize,
  repeatsCreation,
  threadFits,
} from '../rules/comment-threads.ts';

export class CreateCommentThreadService {
  private readonly comments: CommentStore;
  private readonly idSource: IdSource;
  private readonly clock: Clock;
  private readonly options: CreateCommentThreadOptions;

  constructor(
    comments: CommentStore,
    idSource: IdSource,
    clock: Clock,
    options: CreateCommentThreadOptions,
  ) {
    this.comments = comments;
    this.idSource = idSource;
    this.clock = clock;
    this.options = options;
  }

  execute(input: CreateCommentThreadInput): CreateCommentThreadResult {
    const problem = commentAnchorProblem(input.anchor);
    if (problem) throw this.failure(problem);
    const threadId = input.threadId ?? this.idSource.next();
    const messageId = input.messageId ?? this.idSource.next();
    const author = commentAuthor(input.writer);
    const existing = this.comments.find({ threadId });
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
    if (this.comments.findMessage({ messageId }))
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
    const usage = this.comments.usage({ worktreeId: input.worktreeId });
    if (!threadFits(usage, sizeBytes, this.options))
      throw new CommentLimitExceededError();
    return this.comments.insert({
      content,
      sizeBytes,
      writtenByAgent: author === 'agent',
    });
  }

  private failure(problem: CommentAnchorProblem): Error {
    switch (problem.kind) {
      case 'reversed-range':
        return new InvalidLineRangeError();
      case 'revision-mismatch':
        return new CommentRevisionMismatchError();
    }
  }
}
