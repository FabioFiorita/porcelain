export type ReviewRefreshPort = (
  worktreeId: string,
  signal: AbortSignal,
) => Promise<void>;
