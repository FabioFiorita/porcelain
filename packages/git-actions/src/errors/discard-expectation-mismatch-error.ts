import { Schema } from 'effect';

export class DiscardExpectationMismatchError extends Schema.TaggedError<DiscardExpectationMismatchError>()(
  'DiscardExpectationMismatchError',
  {},
) {
  override get message() {
    return 'A discard expects exactly the discarded path';
  }
}
