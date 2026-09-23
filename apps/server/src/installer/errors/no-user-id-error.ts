export class NoUserIdError extends Error {
  override readonly name = 'NoUserIdError';
  constructor() {
    super('Porcelain services require a user id.');
  }
}
