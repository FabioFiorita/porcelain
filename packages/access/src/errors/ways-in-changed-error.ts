import { Schema } from 'effect';

export class WaysInChangedError extends Schema.TaggedError<WaysInChangedError>()(
  'WaysInChangedError',
  {},
) {
  override get message() {
    return 'The ways in changed since you last looked. Check them again, then save your change.';
  }
}
