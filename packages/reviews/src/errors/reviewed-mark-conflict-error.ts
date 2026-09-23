export class ReviewedMarkConflictError extends Error {
  constructor() {
    super('Reviewed mark is based on a version of the file that has changed');
    this.name = 'ReviewedMarkConflictError';
  }
}
