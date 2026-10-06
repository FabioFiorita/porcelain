import { Schema } from 'effect';

export class WorktreeNotFoundError extends Schema.TaggedError<WorktreeNotFoundError>()(
  'WorktreeNotFoundError',
  {},
) {
  override get message() {
    return 'Worktree not found';
  }
}
