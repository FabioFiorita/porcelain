import { Schema } from 'effect';

export class MissingExpectedFilesError extends Schema.TaggedError<MissingExpectedFilesError>()(
  'MissingExpectedFilesError',
  {},
) {
  override get message() {
    return 'This action needs the files the client expects';
  }
}
