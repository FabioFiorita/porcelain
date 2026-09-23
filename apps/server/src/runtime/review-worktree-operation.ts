export type RunReviewWorktreeOperation = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export type ReviewWorktreeAccess = {
  known(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<unknown>;
};
