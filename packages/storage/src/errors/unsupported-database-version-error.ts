import { Schema } from 'effect';

export class UnsupportedDatabaseVersionError extends Schema.TaggedError<UnsupportedDatabaseVersionError>()(
  'UnsupportedDatabaseVersionError',
  { version: Schema.Unknown },
) {
  override get message() {
    return 'Unsupported inventory database version';
  }
}
