export interface CommentWorktreeAccess {
  known(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
}
