import { Schema } from 'effect';

export class UnsupportedCommentComparisonError extends Schema.TaggedError<UnsupportedCommentComparisonError>()(
  'UnsupportedCommentComparisonError',
  {},
) {
  override get message() {
    return 'A comment on the whole change compares only against a branch';
  }
}
