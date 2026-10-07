import { Schema } from 'effect';

export class InvalidInstalledRecordError extends Schema.TaggedError<InvalidInstalledRecordError>()(
  'InvalidInstalledRecordError',
  {},
) {
  override get message() {
    return 'The installed service record is invalid. Preserve the service directory for manual recovery.';
  }
}
