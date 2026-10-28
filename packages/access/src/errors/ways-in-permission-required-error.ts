import { Schema } from 'effect';

export class WaysInPermissionRequiredError extends Schema.TaggedError<WaysInPermissionRequiredError>()(
  'WaysInPermissionRequiredError',
  {},
) {
  override get message() {
    return 'An owner must let this device edit ways in on the computer that runs Porcelain before it can see or change them';
  }
}
