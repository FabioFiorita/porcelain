import { Schema } from 'effect';

export class FileTooLargeError extends Schema.TaggedError<FileTooLargeError>()(
  'FileTooLargeError',
  {},
) {
  override get message() {
    return 'File exceeds the read limit';
  }
}
