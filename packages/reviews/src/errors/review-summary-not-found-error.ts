import { Schema } from 'effect';

export class ReviewSummaryNotFoundError extends Schema.TaggedError<ReviewSummaryNotFoundError>()(
  'ReviewSummaryNotFoundError',
  {},
) {
  override get message() {
    return 'Review summary not found';
  }
}
