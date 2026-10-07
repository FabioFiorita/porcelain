import { Schema } from 'effect';

export class GitOutputLimitError extends Schema.TaggedError<GitOutputLimitError>()(
  'GitOutputLimitError',
  {},
) {
  override get message() {
    return 'Git output exceeds its limit';
  }
}
