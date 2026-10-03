import { GitError } from './git-error.ts';

export class GitTimeoutError extends GitError {
  override readonly name = 'GitTimeoutError';

  constructor(options?: ErrorOptions) {
    super('Git command exceeded its deadline', options);
  }
}
