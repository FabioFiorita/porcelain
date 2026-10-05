import { Schema } from 'effect';

export class DeviceViewerRequiredError extends Schema.TaggedError<DeviceViewerRequiredError>()(
  'DeviceViewerRequiredError',
  {},
) {
  override get message() {
    return 'A live ticket is issued to a paired device';
  }
}
