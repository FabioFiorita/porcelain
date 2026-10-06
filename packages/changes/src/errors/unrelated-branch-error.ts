import { Schema } from 'effect';

export class UnrelatedBranchError extends Schema.TaggedError<UnrelatedBranchError>()(
  'UnrelatedBranchError',
  {},
) {
  override get message() {
    return 'The branch shares no history with its base';
  }
}
