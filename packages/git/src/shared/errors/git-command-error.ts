import { Schema } from 'effect';

export class GitCommandError extends Schema.TaggedError<GitCommandError>()(
  'GitCommandError',
  {
    checkout: Schema.String,
    args: Schema.Array(Schema.String),
    exitCode: Schema.UndefinedOr(Schema.Number),
    stderr: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
  override get message() {
    return 'Git command failed';
  }
}
