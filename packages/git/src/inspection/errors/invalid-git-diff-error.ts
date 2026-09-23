import { GitError } from '../../shared/errors/git-error.ts';

export class InvalidGitDiffError extends GitError {
  override readonly name = 'InvalidGitDiffError';

  constructor() {
    super('Invalid Git diff output');
  }
}
