export class WorktreeUnavailableError extends Error {
  override readonly name = 'WorktreeUnavailableError';

  constructor() {
    super('Worktree is unavailable');
  }
}
