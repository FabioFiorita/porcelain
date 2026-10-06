import { Schema } from 'effect';

export class ServiceUpdateRunningError extends Schema.TaggedError<ServiceUpdateRunningError>()(
  'ServiceUpdateRunningError',
  {},
) {
  override get message() {
    return 'An update is already running';
  }
}
