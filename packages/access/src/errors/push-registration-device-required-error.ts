import { Schema } from 'effect';

export class PushRegistrationDeviceRequiredError extends Schema.TaggedError<PushRegistrationDeviceRequiredError>()(
  'PushRegistrationDeviceRequiredError',
  {},
) {
  override get message() {
    return 'Notifications are registered by a paired device';
  }
}
