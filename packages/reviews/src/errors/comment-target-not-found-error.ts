import { Schema } from 'effect';

export class CommentTargetNotFoundError extends Schema.TaggedError<CommentTargetNotFoundError>()(
  'CommentTargetNotFoundError',
  {},
) {
  override get message() {
    return 'Comment target not found';
  }
}
