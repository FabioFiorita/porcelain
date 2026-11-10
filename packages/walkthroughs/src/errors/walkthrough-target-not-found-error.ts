import { Schema } from 'effect';

export class WalkthroughTargetNotFoundError extends Schema.TaggedError<WalkthroughTargetNotFoundError>()(
  'WalkthroughTargetNotFoundError',
  {},
) {
  override get message() {
    return 'Finished walkthrough or step not found';
  }
}
