import { Schema } from 'effect';

export class UnknownBoxLayerError extends Schema.TaggedError<UnknownBoxLayerError>()(
  'UnknownBoxLayerError',
  {},
) {
  override get message() {
    return 'A diagram box names a layer the review does not have';
  }
}
