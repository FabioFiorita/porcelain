import { Schema } from 'effect';

export class CommitToolMissingError extends Schema.TaggedError<CommitToolMissingError>()(
  'CommitToolMissingError',
  {},
) {
  override get message() {
    return 'The selected coding CLI is not installed.';
  }
}
