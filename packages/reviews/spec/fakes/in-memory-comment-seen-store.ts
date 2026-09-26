import type { CommentSeenMark } from '../../src/models/comment-thread.ts';
import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  seenByWorktrees(input: {
    worktreeIds: readonly string[];
  }): CommentSeenMark[] {
    return [...this.seen]
      .filter(([worktreeId]) => input.worktreeIds.includes(worktreeId))
      .map(([worktreeId, seenThrough]) => ({ worktreeId, seenThrough }));
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
