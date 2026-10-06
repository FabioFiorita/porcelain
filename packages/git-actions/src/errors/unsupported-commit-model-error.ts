import { Schema } from 'effect';

export class UnsupportedCommitModelError extends Schema.TaggedError<UnsupportedCommitModelError>()(
  'UnsupportedCommitModelError',
  {},
) {
  override get message() {
    return 'Unsupported commit model.';
  }
}
