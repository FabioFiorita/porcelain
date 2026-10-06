import { Schema } from 'effect';

export class StepLaneOutOfRangeError extends Schema.TaggedError<StepLaneOutOfRangeError>()(
  'StepLaneOutOfRangeError',
  {},
) {
  override get message() {
    return 'A step names a lane its layer does not have';
  }
}
