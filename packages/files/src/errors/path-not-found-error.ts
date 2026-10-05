import { Schema } from 'effect';

export class PathNotFoundError extends Schema.TaggedError<PathNotFoundError>()(
  'PathNotFoundError',
  {},
) {
  override get message() {
    return 'Path not found';
  }
}
