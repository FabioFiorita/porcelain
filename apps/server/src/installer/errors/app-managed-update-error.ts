import { Schema } from 'effect';

export class AppManagedUpdateError extends Schema.TaggedError<AppManagedUpdateError>()(
  'AppManagedUpdateError',
  {},
) {
  override get message() {
    return 'This server runs inside the Porcelain app, which updates it with the app; the service updater does not run here.';
  }
}
