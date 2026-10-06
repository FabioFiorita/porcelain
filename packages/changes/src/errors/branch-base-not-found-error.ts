import { Schema } from 'effect';

export class BranchBaseNotFoundError extends Schema.TaggedError<BranchBaseNotFoundError>()(
  'BranchBaseNotFoundError',
  {},
) {
  override get message() {
    return 'Base branch not found';
  }
}
