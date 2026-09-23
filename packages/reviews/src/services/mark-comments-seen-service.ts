import type { CommentSeenStore } from '../ports/comment-seen-store.ts';

export class MarkCommentsSeenService {
  private readonly statuses: CommentSeenStore;

  constructor(statuses: CommentSeenStore) {
    this.statuses = statuses;
  }

  execute(
    worktreeId: string,
    throughRevision: number,
  ): { worktreeId: string; seenThrough: number } {
    return {
      worktreeId,
      seenThrough: this.statuses.markSeen(worktreeId, throughRevision),
    };
  }
}
