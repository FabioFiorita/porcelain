import { GitError } from '../../shared/errors/git-error.ts';

export class InvalidHistoryRequestError extends GitError {
  override readonly name = 'InvalidHistoryRequestError';

  constructor(options?: ErrorOptions) {
    super('Invalid history request', options);
  }
}
