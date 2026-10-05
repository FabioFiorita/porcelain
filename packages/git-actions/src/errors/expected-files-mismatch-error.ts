import { Schema } from 'effect';

export class ExpectedFilesMismatchError extends Schema.TaggedError<ExpectedFilesMismatchError>()(
  'ExpectedFilesMismatchError',
  {},
) {
  override get message() {
    return 'The expected files do not match the selected paths';
  }
}
