import { Schema } from 'effect';

export class CommentIdentityConflictError extends Schema.TaggedError<CommentIdentityConflictError>()(
  'CommentIdentityConflictError',
  {},
) {
  override get message() {
    return 'Comment ID belongs to a different write';
  }
}
