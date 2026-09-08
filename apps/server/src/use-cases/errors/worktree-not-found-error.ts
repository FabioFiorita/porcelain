export class WorktreeNotFoundError extends Error {
  override readonly name = 'WorktreeNotFoundError';
  constructor() {
    super('Worktree not found');
  }
}
