import { GitError } from './git-error.ts';

export class UnsupportedRepositoryError extends GitError {
  override readonly name = 'UnsupportedRepositoryError';

  constructor() {
    super('Bare repositories are not supported');
  }
}
