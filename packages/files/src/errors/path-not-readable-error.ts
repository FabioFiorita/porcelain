import { Schema } from 'effect';

export class PathNotReadableError extends Schema.TaggedError<PathNotReadableError>()(
  'PathNotReadableError',
  {},
) {
  override get message() {
    return 'Path could not be read';
  }
}
