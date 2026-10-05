import { Schema } from 'effect';

export class ReviewedMarkConflictError extends Schema.TaggedError<ReviewedMarkConflictError>()(
  'ReviewedMarkConflictError',
  {},
) {
  override get message() {
    return 'The reviewed mark is based on a version that has changed';
  }
}
