import { Schema } from 'effect';

export class FolderNotReadableError extends Schema.TaggedError<FolderNotReadableError>()(
  'FolderNotReadableError',
  {},
) {
  override get message() {
    return 'Path could not be read';
  }
}
