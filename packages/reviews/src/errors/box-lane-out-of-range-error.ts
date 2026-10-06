import { Schema } from 'effect';

export class BoxLaneOutOfRangeError extends Schema.TaggedError<BoxLaneOutOfRangeError>()(
  'BoxLaneOutOfRangeError',
  {},
) {
  override get message() {
    return 'A diagram box names a lane its diagram does not have';
  }
}
