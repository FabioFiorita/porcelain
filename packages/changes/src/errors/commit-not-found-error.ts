export class CommitNotFoundError extends Error {
  override readonly name = 'CommitNotFoundError';

  constructor() {
    super('Commit not found');
  }
}
