export class ReviewSummaryNotFoundError extends Error {
  override readonly name = 'ReviewSummaryNotFoundError';

  constructor() {
    super('Review summary not found');
  }
}
