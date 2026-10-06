import { Schema } from 'effect';

export class UnnamedDiffSelectionError extends Schema.TaggedError<UnnamedDiffSelectionError>()(
  'UnnamedDiffSelectionError',
  {},
) {
  override get message() {
    return 'A diff selection names neither an old nor a new path';
  }
}
