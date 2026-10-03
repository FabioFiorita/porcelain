import { GitError } from './git-error.ts';

export class GitOutputLimitError extends GitError {
  override readonly name = 'GitOutputLimitError';

  constructor(options?: ErrorOptions) {
    super('Git output exceeds its limit', options);
  }
}
