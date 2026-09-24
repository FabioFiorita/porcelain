import type { CommentSeenMark } from '../models/comment-thread.ts';

export interface CommentSeenStore {
  seenThrough(input: { worktreeId: string }): number;
  seenByWorktrees(input: { worktreeIds: readonly string[] }): CommentSeenMark[];
  save(input: { worktreeId: string; seenThrough: number }): void;
}
