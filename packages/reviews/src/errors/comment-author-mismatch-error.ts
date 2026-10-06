import { Schema } from 'effect';

export class CommentAuthorMismatchError extends Schema.TaggedError<CommentAuthorMismatchError>()(
  'CommentAuthorMismatchError',
  {},
) {
  override get message() {
    return 'Only the author of a comment may change it';
  }
}
