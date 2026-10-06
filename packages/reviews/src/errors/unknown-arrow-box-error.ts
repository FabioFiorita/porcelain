import { Schema } from 'effect';

export class UnknownArrowBoxError extends Schema.TaggedError<UnknownArrowBoxError>()(
  'UnknownArrowBoxError',
  {},
) {
  override get message() {
    return 'A diagram arrow joins a box its diagram does not have';
  }
}
