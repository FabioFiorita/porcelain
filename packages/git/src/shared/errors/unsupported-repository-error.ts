import { Schema } from 'effect';

export class UnsupportedRepositoryError extends Schema.TaggedError<UnsupportedRepositoryError>()(
  'UnsupportedRepositoryError',
  {},
) {
  override get message() {
    return 'Bare repositories are not supported';
  }
}
