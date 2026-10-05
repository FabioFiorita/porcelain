import { Schema } from 'effect';

export class InvalidLineRangeError extends Schema.TaggedError<InvalidLineRangeError>()(
  'InvalidLineRangeError',
  {},
) {
  override get message() {
    return 'The line range ends before it starts';
  }
}
