import { Schema } from 'effect';

export class ReviewConflictError extends Schema.TaggedError<ReviewConflictError>()(
  'ReviewConflictError',
  {},
) {
  override get message() {
    return 'The review changed; reload before retrying';
  }
}
