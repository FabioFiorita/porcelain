import { Schema } from 'effect';

export class DraftCommentPublishedError extends Schema.TaggedError<DraftCommentPublishedError>()(
  'DraftCommentPublishedError',
  {},
) {
  override get message() {
    return 'This comment has already been posted. Refresh to see the published review.';
  }
}
