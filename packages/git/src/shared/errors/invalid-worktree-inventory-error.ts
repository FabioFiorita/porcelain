import { GitError } from './git-error.ts';

export class InvalidWorktreeInventoryError extends GitError {
  override readonly name = 'InvalidWorktreeInventoryError';

  constructor() {
    super('Git worktree inventory is invalid');
  }
}
