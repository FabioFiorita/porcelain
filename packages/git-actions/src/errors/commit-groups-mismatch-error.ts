import { Schema } from 'effect';

export class CommitGroupsMismatchError extends Schema.TaggedError<CommitGroupsMismatchError>()(
  'CommitGroupsMismatchError',
  {},
) {
  override get message() {
    return 'The generated draft did not cover the selected files. Generate again or write the message manually.';
  }
}
