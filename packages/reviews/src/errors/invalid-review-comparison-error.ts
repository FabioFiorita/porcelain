import { Schema } from 'effect';
export class InvalidReviewComparisonError extends Schema.TaggedError<InvalidReviewComparisonError>()(
  'InvalidReviewComparisonError',
  {},
) {
  override get message() {
    return 'The from revision must not be newer than the to revision';
  }
}
