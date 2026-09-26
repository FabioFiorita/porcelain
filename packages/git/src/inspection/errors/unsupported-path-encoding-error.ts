import { GitError } from '../../shared/errors/git-error.ts';

export class UnsupportedPathEncodingError extends GitError {
  override readonly name = 'UnsupportedPathEncodingError';

  constructor(options?: ErrorOptions) {
    super('Git paths require valid UTF-8', options);
  }
}
