import { Schema } from 'effect';

export class EntryExistsError extends Schema.TaggedError<EntryExistsError>()(
  'EntryExistsError',
  {},
) {
  override get message() {
    return 'An entry already exists at that path';
  }
}
