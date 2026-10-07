import { Schema } from 'effect';

export class ServiceStillActiveError extends Schema.TaggedError<ServiceStillActiveError>()(
  'ServiceStillActiveError',
  {
    after: Schema.Literals(['stop', 'disable']),
  },
) {
  override get message() {
    return `porcelain.service remained active after ${this.after}.`;
  }
}
