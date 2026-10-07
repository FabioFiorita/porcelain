import { Schema } from 'effect';

export class GitFilesystemError extends Schema.TaggedError<GitFilesystemError>()(
  'GitFilesystemError',
  { cause: Schema.Unknown },
) {
  override get message() {
    return 'Git metadata could not be read';
  }
}
