export class WorktreeNotFoundError extends Error {
  constructor() {
    super('Worktree not found');
    this.name = 'WorktreeNotFoundError';
  }
}
