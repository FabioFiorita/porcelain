import { GitError } from './git-error.ts';

export class RepositoryIdentityMismatchError extends GitError {
  override readonly name = 'RepositoryIdentityMismatchError';

  constructor() {
    super('Checkout belongs to another repository');
  }
}
