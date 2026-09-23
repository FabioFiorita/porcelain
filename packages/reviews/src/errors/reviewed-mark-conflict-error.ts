export class ReviewedMarkConflictError extends Error {
  override readonly name = 'ReviewedMarkConflictError';

  constructor() {
    super('Reviewed mark is based on a version that has changed');
  }
}
