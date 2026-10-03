import { GitError } from './git-error.ts';

export class UnsupportedFilesystemIdentityError extends GitError {
  override readonly name = 'UnsupportedFilesystemIdentityError';

  constructor() {
    super(
      'Filesystem birth time is required for conservative identity matching',
    );
  }
}
