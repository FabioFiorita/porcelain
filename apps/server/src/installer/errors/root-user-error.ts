import { Schema } from 'effect';

export class RootUserError extends Schema.TaggedError<RootUserError>()(
  'RootUserError',
  {},
) {
  override get message() {
    return 'Refusing to manage Porcelain as root. Run this command as the user who will use Porcelain.';
  }
}
