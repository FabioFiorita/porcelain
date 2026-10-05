import { Schema } from 'effect';

export class MissingEnvironmentIdentityError extends Schema.TaggedError<MissingEnvironmentIdentityError>()(
  'MissingEnvironmentIdentityError',
  {},
) {
  override get message() {
    return 'This server has no environment identity.';
  }
}
