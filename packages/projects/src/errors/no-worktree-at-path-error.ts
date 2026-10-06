import { Schema } from 'effect';

export class NoWorktreeAtPathError extends Schema.TaggedError<NoWorktreeAtPathError>()(
  'NoWorktreeAtPathError',
  {},
) {
  override get message() {
    return 'No registered Porcelain worktree contains this path';
  }
}
