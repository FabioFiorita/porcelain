import { Schema } from 'effect';

export class UnsupportedFilesystemIdentityError extends Schema.TaggedError<UnsupportedFilesystemIdentityError>()(
  'UnsupportedFilesystemIdentityError',
  {},
) {
  override get message() {
    return 'Filesystem birth time is required for conservative identity matching';
  }
}
