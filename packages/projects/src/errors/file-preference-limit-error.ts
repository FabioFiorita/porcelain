import { Schema } from 'effect';

export class FilePreferenceLimitError extends Schema.TaggedError<FilePreferenceLimitError>()(
  'FilePreferenceLimitError',
  {},
) {
  override get message() {
    return 'File preference limit reached';
  }
}
