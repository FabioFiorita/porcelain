import { GitError } from './git-error.ts';

export class GitCommandError extends GitError {
  override readonly name = 'GitCommandError';
  readonly checkout: string;
  readonly args: readonly string[];
  readonly exitCode: number | undefined;
  readonly stderr: string;

  constructor(
    checkout: string,
    args: readonly string[],
    failure: { exitCode: number | undefined; stderr: string },
    options?: ErrorOptions,
  ) {
    super('Git command failed', options);
    this.checkout = checkout;
    this.args = [...args];
    this.exitCode = failure.exitCode;
    this.stderr = failure.stderr;
  }
}
