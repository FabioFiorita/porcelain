import { GitError } from '../../shared/errors/git-error.ts';

export class UnsupportedHistoryDataError extends GitError {
  override readonly name = 'UnsupportedHistoryDataError';

  constructor(options?: ErrorOptions) {
    super('History contains unsupported data', options);
  }
}
