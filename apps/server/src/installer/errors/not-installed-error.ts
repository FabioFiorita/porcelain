import { Schema } from 'effect';

export class NotInstalledError extends Schema.TaggedError<NotInstalledError>()(
  'NotInstalledError',
  {},
) {
  override get message() {
    return 'Porcelain service is not installed. Run `porcelain service install`.';
  }
}
