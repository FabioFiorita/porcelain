import { Schema } from 'effect';

export class ManagementLockHeldError extends Schema.TaggedError<ManagementLockHeldError>()(
  'ManagementLockHeldError',
  {},
) {
  override get message() {
    return 'Another Porcelain service command is already running. Wait for it to finish.';
  }
}
