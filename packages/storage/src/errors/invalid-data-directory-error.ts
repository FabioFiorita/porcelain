import { Schema } from 'effect';

export class InvalidDataDirectoryError extends Schema.TaggedError<InvalidDataDirectoryError>()(
  'InvalidDataDirectoryError',
  {},
) {
  override get message() {
    return 'An absolute data directory is required';
  }
}
