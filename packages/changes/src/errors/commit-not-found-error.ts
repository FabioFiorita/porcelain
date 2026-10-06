import { Schema } from 'effect';

export class CommitNotFoundError extends Schema.TaggedError<CommitNotFoundError>()(
  'CommitNotFoundError',
  {},
) {
  override get message() {
    return 'Commit not found';
  }
}
