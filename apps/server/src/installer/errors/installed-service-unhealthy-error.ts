import { Schema } from 'effect';

export class InstalledServiceUnhealthyError extends Schema.TaggedError<InstalledServiceUnhealthyError>()(
  'InstalledServiceUnhealthyError',
  {},
) {
  override get message() {
    return 'The installed service did not become healthy.';
  }
}
