import { Schema } from 'effect';

export class RepositoryIdentityMismatchError extends Schema.TaggedError<RepositoryIdentityMismatchError>()(
  'RepositoryIdentityMismatchError',
  {},
) {
  override get message() {
    return 'Checkout belongs to another repository';
  }
}
