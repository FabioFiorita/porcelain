export class InvalidGitStatusError extends Error {
  override readonly name = 'InvalidGitStatusError';

  constructor() {
    super('Invalid Git status output');
  }
}
