import { Schema } from 'effect';

export class CrossDeviceMoveError extends Schema.TaggedError<CrossDeviceMoveError>()(
  'CrossDeviceMoveError',
  {},
) {
  override get message() {
    return 'Destination is on another filesystem; nothing was moved';
  }
}
