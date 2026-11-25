import { Schema } from 'effect';

export class DraftCommentNotFoundError extends Schema.TaggedError<DraftCommentNotFoundError>()(
  'DraftCommentNotFoundError',
  {},
) {
  override get message() {
    return 'This comment no longer exists.';
  }
}
