import { Schema } from 'effect';

export class GitActionNotFoundError extends Schema.TaggedError<GitActionNotFoundError>()(
  'GitActionNotFoundError',
  {},
) {
  override get message() {
    return 'Git action receipt not found';
  }
}
