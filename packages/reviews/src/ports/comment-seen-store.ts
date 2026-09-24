export interface CommentSeenStore {
  seenThrough(input: { worktreeId: string }): number;
  save(input: { worktreeId: string; seenThrough: number }): void;
}
