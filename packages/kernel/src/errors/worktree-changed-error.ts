import { Schema } from 'effect';

export class WorktreeChangedError extends Schema.TaggedError<WorktreeChangedError>()(
  'WorktreeChangedError',
  {},
) {
  override get message() {
    return 'Worktree changed during inspection';
  }
}
