export class RepositoryIdentityMismatchError extends Error {
  override readonly name = 'RepositoryIdentityMismatchError';
  constructor() {
    super('Checkout belongs to another repository');
  }
}
