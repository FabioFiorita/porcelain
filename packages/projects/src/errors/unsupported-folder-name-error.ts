import { Schema } from 'effect';

export class UnsupportedFolderNameError extends Schema.TaggedError<UnsupportedFolderNameError>()(
  'UnsupportedFolderNameError',
  {},
) {
  override get message() {
    return 'Directory contains a name that is not supported UTF-8';
  }
}
