export class NoWorktreeAtPathError extends Error {
  override readonly name = 'NoWorktreeAtPathError';

  constructor() {
    super('No registered Porcelain worktree contains this path');
  }
}
