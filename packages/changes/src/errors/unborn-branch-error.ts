import { Schema } from 'effect';

export class UnbornBranchError extends Schema.TaggedError<UnbornBranchError>()(
  'UnbornBranchError',
  {},
) {
  override get message() {
    return 'The branch has no commits yet';
  }
}
