import type {
  DeleteResolvedCommentsInput,
  DeleteResolvedCommentsResult,
} from '../models/delete-resolved-comments.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import { commentAuthor, startedBy } from '../rules/comment-threads.ts';

export class DeleteResolvedCommentsService {
  private readonly comments: CommentStore;

  constructor(comments: CommentStore) {
    this.comments = comments;
  }

  execute(input: DeleteResolvedCommentsInput): DeleteResolvedCommentsResult {
    const author = commentAuthor(input.writer);
    const resolved = this.comments
      .list({ worktreeId: input.worktreeId })
      .filter((thread) => thread.resolved);
    const deleted = resolved.filter((thread) => startedBy(thread, author));
    for (const thread of deleted) this.comments.remove({ threadId: thread.id });
    return {
      deleted: deleted.map((thread) => thread.id),
      kept: resolved.length - deleted.length,
    };
  }
}
