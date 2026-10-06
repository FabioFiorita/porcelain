import { Schema } from 'effect';

export class CommitToolFailedError extends Schema.TaggedError<CommitToolFailedError>()(
  'CommitToolFailedError',
  {},
) {
  override get message() {
    return 'Commit generation failed. Check that the selected CLI is up to date and signed in.';
  }
}
