export interface CommentSeenStore {
  seenThrough(worktreeId: string): number;
  save(worktreeId: string, seenThrough: number): void;
}
