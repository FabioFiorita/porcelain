import { Schema } from 'effect';

export class DuplicateLayerIdError extends Schema.TaggedError<DuplicateLayerIdError>()(
  'DuplicateLayerIdError',
  {},
) {
  override get message() {
    return 'Layer IDs repeat within the review';
  }
}
