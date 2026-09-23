import { GitError } from '../../shared/errors/git-error.ts';

export class HistoryWorktreeUnavailableError extends GitError {
  override readonly name = 'HistoryWorktreeUnavailableError';

  constructor(options?: ErrorOptions) {
    super('Worktree is unavailable', options);
  }
}
