import { Schema } from 'effect';

export class RemoteRouteInUseError extends Schema.TaggedError<RemoteRouteInUseError>()(
  'RemoteRouteInUseError',
  {},
) {
  override get message() {
    return 'This device is connected through this way in, so it cannot change it. Change it on the computer that runs Porcelain, or from a device connected another way.';
  }
}
