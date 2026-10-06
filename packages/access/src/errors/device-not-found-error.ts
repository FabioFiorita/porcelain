import { Schema } from 'effect';

export class DeviceNotFoundError extends Schema.TaggedError<DeviceNotFoundError>()(
  'DeviceNotFoundError',
  {},
) {
  override get message() {
    return 'Device not found';
  }
}
