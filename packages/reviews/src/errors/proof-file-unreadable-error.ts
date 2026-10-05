import { Schema } from 'effect';

export class ProofFileUnreadableError extends Schema.TaggedError<ProofFileUnreadableError>()(
  'ProofFileUnreadableError',
  {},
) {
  override get message() {
    return 'A proof file is missing from the worktree or is not a readable file';
  }
}
