import { Schema } from 'effect';

export class CommitDraftSelectionError extends Schema.TaggedError<CommitDraftSelectionError>()(
  'CommitDraftSelectionError',
  {},
) {
  override get message() {
    return 'Select readable changed files to generate a commit draft.';
  }
}
