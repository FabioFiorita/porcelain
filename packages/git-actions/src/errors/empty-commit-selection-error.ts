import { Schema } from 'effect';

export class EmptyCommitSelectionError extends Schema.TaggedError<EmptyCommitSelectionError>()(
  'EmptyCommitSelectionError',
  {},
) {
  override get message() {
    return 'Select at least one path to commit';
  }
}
