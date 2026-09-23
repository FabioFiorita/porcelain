import type {
  MarkCommentsSeenInput,
  MarkCommentsSeenResult,
} from '../models/comment-operations.ts';
import type { CommentSeenStore } from '../ports/comment-seen-store.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import { seenThrough } from '../rules/comment-threads.ts';

export class MarkCommentsSeenService {
  private readonly commentSeenStore: CommentSeenStore;
  private readonly commentStore: CommentStore;

  constructor(commentSeenStore: CommentSeenStore, commentStore: CommentStore) {
    this.commentSeenStore = commentSeenStore;
    this.commentStore = commentStore;
  }

  execute(input: MarkCommentsSeenInput): MarkCommentsSeenResult {
    const seen = seenThrough(
      this.commentSeenStore.seenThrough(input.worktreeId),
      input.throughRevision,
      this.commentStore.lastRevisionIn(input.worktreeId),
    );
    this.commentSeenStore.save(input.worktreeId, seen);
    return { worktreeId: input.worktreeId, seenThrough: seen };
  }
}
