import { Schema } from 'effect';

export class WalkthroughAssetNotFoundError extends Schema.TaggedError<WalkthroughAssetNotFoundError>()(
  'WalkthroughAssetNotFoundError',
  {},
) {
  override get message() {
    return 'Walkthrough evidence asset not found';
  }
}
