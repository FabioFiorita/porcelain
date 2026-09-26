import { GitError } from '../../shared/errors/git-error.ts';

export class UnsupportedGitFiltersError extends GitError {
  override readonly name = 'UnsupportedGitFiltersError';

  constructor() {
    super('Git conversion filters are unsupported for worktree inspection');
  }
}
