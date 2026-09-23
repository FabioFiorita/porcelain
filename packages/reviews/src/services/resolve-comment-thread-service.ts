import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import type {
  ResolveCommentThreadInput,
  ResolveCommentThreadResult,
} from '../models/comment-operations.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import { commentStorageSize } from '../rules/comment-threads.ts';

export class ResolveCommentThreadService {
  private readonly commentStore: CommentStore;

  constructor(commentStore: CommentStore) {
    this.commentStore = commentStore;
  }

  execute(input: ResolveCommentThreadInput): ResolveCommentThreadResult {
    const current = this.commentStore.find(input.threadId);
    if (!current || current.worktreeId !== input.worktreeId)
      throw new CommentTargetNotFoundError();
    if (current.resolved === input.resolved) return current;
    const revision = this.commentStore.lastRevision() + 1;
    this.commentStore.resolve(current.id, {
      resolved: input.resolved,
      revision,
      sizeBytes: commentStorageSize(current),
    });
    return { ...current, resolved: input.resolved, revision };
  }
}
