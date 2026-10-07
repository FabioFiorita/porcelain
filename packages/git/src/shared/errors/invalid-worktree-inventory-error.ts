import { Schema } from 'effect';

export class InvalidWorktreeInventoryError extends Schema.TaggedError<InvalidWorktreeInventoryError>()(
  'InvalidWorktreeInventoryError',
  {},
) {
  override get message() {
    return 'Git worktree inventory is invalid';
  }
}
