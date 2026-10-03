export class ReviewConflictError extends Error {
  override readonly name = 'ReviewConflictError';

  constructor() {
    super('The review changed; reload before retrying');
  }
}
