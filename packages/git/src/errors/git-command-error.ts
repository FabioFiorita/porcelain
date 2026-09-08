export class GitCommandError extends Error {
  override readonly name = 'GitCommandError';
  readonly checkout: string;
  readonly args: readonly string[];

  constructor(checkout: string, args: readonly string[], cause: unknown) {
    super('Git command failed', { cause });
    this.checkout = checkout;
    this.args = [...args];
  }
}
