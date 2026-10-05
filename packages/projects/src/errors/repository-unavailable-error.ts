import { Schema } from 'effect';

export class RepositoryUnavailableError extends Schema.TaggedError<RepositoryUnavailableError>()(
  'RepositoryUnavailableError',
  {},
) {
  override get message() {
    return 'Repository could not be inspected';
  }
}
