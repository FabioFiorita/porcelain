export class GitActionNotFoundError extends Error {
  override readonly name = 'GitActionNotFoundError';

  constructor() {
    super('Git action receipt not found');
  }
}
