import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import type {
  UpdateCommentThreadInput,
  UpdateCommentThreadResult,
} from '../models/update-comment-thread.ts';
import type { CommentStore } from '../ports/comment-store.ts';

export class UpdateCommentThreadService {
  private readonly comments: CommentStore;

  constructor(comments: CommentStore) {
    this.comments = comments;
  }

  execute(input: UpdateCommentThreadInput): UpdateCommentThreadResult {
    const current = this.comments.find({ threadId: input.threadId });
    if (!current || current.worktreeId !== input.worktreeId)
      throw new CommentTargetNotFoundError();
    if (current.resolved === input.resolved) return current;
    return this.comments.resolve({ thread: current, resolved: input.resolved });
  }
}
