import { Schema } from 'effect';

export class ServiceUpdateNotOfferedError extends Schema.TaggedError<ServiceUpdateNotOfferedError>()(
  'ServiceUpdateNotOfferedError',
  {},
) {
  override get message() {
    return 'That version is not the newer version this server offers';
  }
}
