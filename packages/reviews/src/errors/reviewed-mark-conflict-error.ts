export class ReviewedMarkConflictError extends Error {
  override readonly name = 'ReviewedMarkConflictError';

  constructor() {
    super('The reviewed mark is based on a version that has changed');
  }
}
