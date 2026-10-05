import { Schema } from 'effect';

export class DuplicateExpectedFileError extends Schema.TaggedError<DuplicateExpectedFileError>()(
  'DuplicateExpectedFileError',
  {},
) {
  override get message() {
    return 'Each expected file may appear only once';
  }
}
