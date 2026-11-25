import { Schema } from 'effect';

export class WalkthroughCallNotFoundError extends Schema.TaggedError<WalkthroughCallNotFoundError>()(
  'WalkthroughCallNotFoundError',
  {},
) {
  override get message() {
    return 'This call or option is not in the walkthrough';
  }
}
