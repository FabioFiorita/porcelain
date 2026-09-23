export class UnsupportedRepositoryError extends Error {
  override readonly name = 'UnsupportedRepositoryError';
  constructor() {
    super('Bare repositories are not supported');
  }
}
