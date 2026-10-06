import { Schema } from 'effect';

export class CommitDraftTooLargeError extends Schema.TaggedError<CommitDraftTooLargeError>()(
  'CommitDraftTooLargeError',
  {},
) {
  override get message() {
    return 'Select fewer files to generate a commit draft.';
  }
}
