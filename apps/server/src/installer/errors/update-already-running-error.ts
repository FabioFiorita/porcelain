import { Schema } from 'effect';

export class UpdateAlreadyRunningError extends Schema.TaggedError<UpdateAlreadyRunningError>()(
  'UpdateAlreadyRunningError',
  {},
) {
  override get message() {
    return 'Another Porcelain service update is already running. Run `porcelain service update` again once it finishes.';
  }
}
