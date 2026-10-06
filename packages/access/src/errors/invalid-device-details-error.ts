import { Schema } from 'effect';

export class InvalidDeviceDetailsError extends Schema.TaggedError<InvalidDeviceDetailsError>()(
  'InvalidDeviceDetailsError',
  {},
) {
  override get message() {
    return 'The device name or platform is missing, too long, or contains control characters.';
  }
}
