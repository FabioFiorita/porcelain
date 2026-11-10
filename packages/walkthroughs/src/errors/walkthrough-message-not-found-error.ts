import { Schema } from 'effect';

export class WalkthroughMessageNotFoundError extends Schema.TaggedError<WalkthroughMessageNotFoundError>()(
  'WalkthroughMessageNotFoundError',
  {},
) {
  override get message() {
    return 'Walkthrough message not found';
  }
}
