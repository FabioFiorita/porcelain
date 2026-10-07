import { Schema } from 'effect';

export class AlreadyInstalledError extends Schema.TaggedError<AlreadyInstalledError>()(
  'AlreadyInstalledError',
  {},
) {
  override get message() {
    return 'Porcelain is already installed; run porcelain service update to change it.';
  }
}
