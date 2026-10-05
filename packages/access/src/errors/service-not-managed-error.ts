import { Schema } from 'effect';

export class ServiceNotManagedError extends Schema.TaggedError<ServiceNotManagedError>()(
  'ServiceNotManagedError',
  {},
) {
  override get message() {
    return 'Porcelain is not running as the installed service, so it cannot update itself';
  }
}
