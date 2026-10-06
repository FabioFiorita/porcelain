import { Schema } from 'effect';

export class MergeExpectationMismatchError extends Schema.TaggedError<MergeExpectationMismatchError>()(
  'MergeExpectationMismatchError',
  {},
) {
  override get message() {
    return 'A merge in progress and its merge head must be expected together';
  }
}
