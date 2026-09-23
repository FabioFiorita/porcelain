export interface CommentSeenStore {
  markSeen(worktreeId: string, throughRevision: number): number;
}
