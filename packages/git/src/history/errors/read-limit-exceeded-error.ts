import { GitError } from '../../shared/errors/git-error.ts';

export class ReadLimitExceededError extends GitError {
  override readonly name = 'ReadLimitExceededError';

  constructor(options?: ErrorOptions) {
    super('History read exceeds its limit', options);
  }
}
