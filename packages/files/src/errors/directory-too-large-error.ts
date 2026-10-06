import { Schema } from 'effect';

export class DirectoryTooLargeError extends Schema.TaggedError<DirectoryTooLargeError>()(
  'DirectoryTooLargeError',
  {},
) {
  override get message() {
    return 'Directory exceeds the listing limit';
  }
}
