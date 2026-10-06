import { Schema } from 'effect';

export class UnsupportedEntryNameError extends Schema.TaggedError<UnsupportedEntryNameError>()(
  'UnsupportedEntryNameError',
  {},
) {
  override get message() {
    return 'Directory contains a name that is not supported UTF-8';
  }
}
