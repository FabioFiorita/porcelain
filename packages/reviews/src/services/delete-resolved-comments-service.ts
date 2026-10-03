import type {
  DeleteResolvedCommentsInput,
  DeleteResolvedCommentsResult,
} from '../models/delete-resolved-comments.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  unchangedResolvedThread,
} from '../rules/comment-threads.ts';

export class DeleteResolvedCommentsService {
  private readonly comments: CommentStore;

  constructor(comments: CommentStore) {
    this.comments = comments;
  }

  execute(input: DeleteResolvedCommentsInput): DeleteResolvedCommentsResult {
    const author = commentAuthor(input.writer);
    const deleted: string[] = [];
    const skipped: string[] = [];
    for (const confirmed of input.threads) {
      const thread = this.comments.find({ threadId: confirmed.threadId });
      if (
        thread !== undefined &&
        unchangedResolvedThread(thread, {
          worktreeId: input.worktreeId,
          revision: confirmed.revision,
          author,
        })
      ) {
        this.comments.remove({ threadId: thread.id });
        deleted.push(thread.id);
      } else skipped.push(confirmed.threadId);
    }
    return { deleted, skipped };
  }
}
