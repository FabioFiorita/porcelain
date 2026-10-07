import { Schema } from 'effect';

export class NoUserIdError extends Schema.TaggedError<NoUserIdError>()(
  'NoUserIdError',
  {},
) {
  override get message() {
    return 'Porcelain services require a user id.';
  }
}
