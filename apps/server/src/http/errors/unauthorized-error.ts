export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';

  constructor() {
    super('Authentication required');
  }
}
