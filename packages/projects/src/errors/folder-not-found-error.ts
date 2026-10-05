import { Schema } from 'effect';

export class FolderNotFoundError extends Schema.TaggedError<FolderNotFoundError>()(
  'FolderNotFoundError',
  {},
) {
  override get message() {
    return 'Path not found';
  }
}
