import { Schema } from 'effect';

export class UntrustedDeviceError extends Schema.TaggedError<UntrustedDeviceError>()(
  'UntrustedDeviceError',
  {},
) {
  override get message() {
    return 'An owner must trust this device on the computer that runs Porcelain before it can update Porcelain';
  }
}
