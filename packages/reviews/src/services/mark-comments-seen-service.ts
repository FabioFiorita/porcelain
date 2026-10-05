import { Effect } from 'effect';
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

  execute(
    input: MarkCommentsSeenInput,
  ): Effect.Effect<MarkCommentsSeenResult, never> {
    return Effect.sync(() => {
      const { worktreeId } = input;
      const before = this.commentSeen.seenThrough({ worktreeId });
      const seen = seenThrough(
        before,
        input.throughRevision,
        this.comments.lastRevision({ worktreeId }),
      );
      if (seen === before)
        return { worktreeId, seenThrough: seen, changed: false };
      this.commentSeen.save({ worktreeId, seenThrough: seen });
      return { worktreeId, seenThrough: seen, changed: true };
    });
  }
}
