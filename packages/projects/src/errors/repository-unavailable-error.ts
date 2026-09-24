export class RepositoryUnavailableError extends Error {
  override readonly name = 'RepositoryUnavailableError';

  constructor() {
    super('Repository could not be inspected');
  }
}
