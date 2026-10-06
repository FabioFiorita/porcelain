import { Schema } from 'effect';

export class CommentLimitExceededError extends Schema.TaggedError<CommentLimitExceededError>()(
  'CommentLimitExceededError',
  {},
) {
  override get message() {
    return 'Comment capacity exceeded';
  }
}
