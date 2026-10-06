import { GitError } from './git-error.ts';

export class InvalidGitStatusError extends GitError {
  override readonly name = 'InvalidGitStatusError';

  constructor() {
    super('Invalid Git status output');
  }
}
