export class ReviewedMarkConflictError extends Error {
  constructor() {
    super('Reviewed mark is based on stale evidence');
    this.name = 'ReviewedMarkConflictError';
  }
}
