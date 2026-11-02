import { Schema } from 'effect';

export class SharingManagementRequiredError extends Schema.TaggedError<SharingManagementRequiredError>()(
  'SharingManagementRequiredError',
  {},
) {
  override get message() {
    return 'This device cannot manage sharing. Allow it from a device with sharing access.';
  }
}
