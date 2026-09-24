import type {
  MarkCommentsSeenInput,
  MarkCommentsSeenResult,
} from '../models/mark-comments-seen.ts';
import type { CommentSeenStore } from '../ports/comment-seen-store.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import { seenThrough } from '../rules/comment-threads.ts';

export class MarkCommentsSeenService {
  private readonly commentSeen: CommentSeenStore;
  private readonly comments: CommentStore;

  constructor(commentSeen: CommentSeenStore, comments: CommentStore) {
    this.commentSeen = commentSeen;
    this.comments = comments;
  }

  execute(input: MarkCommentsSeenInput): MarkCommentsSeenResult {
    const { worktreeId } = input;
    const seen = seenThrough(
      this.commentSeen.seenThrough({ worktreeId }),
      input.throughRevision,
      this.comments.lastRevision({ worktreeId }),
    );
    this.commentSeen.save({ worktreeId, seenThrough: seen });
    return { worktreeId, seenThrough: seen };
  }
}
