export class CommitToolMissingError extends Error {
  override readonly name = 'CommitToolMissingError';

  constructor() {
    super('The selected coding CLI is not installed.');
  }
}
