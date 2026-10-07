import { Schema } from 'effect';

export class GitTimeoutError extends Schema.TaggedError<GitTimeoutError>()(
  'GitTimeoutError',
  {},
) {
  override get message() {
    return 'Git command exceeded its deadline';
  }
}
