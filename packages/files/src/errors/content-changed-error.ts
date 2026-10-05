import { Schema } from 'effect';

export class ContentChangedError extends Schema.TaggedError<ContentChangedError>()(
  'ContentChangedError',
  {},
) {
  override get message() {
    return 'Content changed; retry the operation';
  }
}
