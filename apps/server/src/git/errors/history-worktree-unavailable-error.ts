export class HistoryWorktreeUnavailableError extends Error {
  override readonly name = 'HistoryWorktreeUnavailableError';
  constructor(cause?: unknown) {
    super('Worktree is unavailable', { cause });
  }
}
