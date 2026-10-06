import { Schema } from 'effect';

export class UnsupportedTextError extends Schema.TaggedError<UnsupportedTextError>()(
  'UnsupportedTextError',
  {},
) {
  override get message() {
    return 'File is not supported UTF-8 text';
  }
}
