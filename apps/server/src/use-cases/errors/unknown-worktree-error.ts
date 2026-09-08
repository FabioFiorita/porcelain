export class UnknownWorktreeError extends Error {
  constructor() {
    super('Unknown worktree');
    this.name = 'UnknownWorktreeError';
  }
}
