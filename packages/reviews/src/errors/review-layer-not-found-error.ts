import { Schema } from 'effect';

export class ReviewLayerNotFoundError extends Schema.TaggedError<ReviewLayerNotFoundError>()(
  'ReviewLayerNotFoundError',
  {},
) {
  override get message() {
    return 'Review layer not found';
  }
}
