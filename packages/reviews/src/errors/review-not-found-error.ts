import { Schema } from 'effect';
export class ReviewNotFoundError extends Schema.TaggedError<ReviewNotFoundError>()(
  'ReviewNotFoundError',
  {},
) {
  override get message() {
    return 'Review or revision not found';
  }
}
