import { Schema } from 'effect';

export class CommentRevisionMismatchError extends Schema.TaggedError<CommentRevisionMismatchError>()(
  'CommentRevisionMismatchError',
  {},
) {
  override get message() {
    return 'The comparison must identify the revision it belongs to';
  }
}
