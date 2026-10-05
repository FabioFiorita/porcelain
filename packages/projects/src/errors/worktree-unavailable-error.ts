import { Schema } from 'effect';

export class WorktreeUnavailableError extends Schema.TaggedError<WorktreeUnavailableError>()(
  'WorktreeUnavailableError',
  {},
) {
  override get message() {
    return 'Worktree is unavailable';
  }
}
