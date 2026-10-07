import { Schema } from 'effect';

export class ServiceCommandFailedError extends Schema.TaggedError<ServiceCommandFailedError>()(
  'ServiceCommandFailedError',
  {
    description: Schema.String,
    detail: Schema.String,
  },
) {
  override get message() {
    return `${this.description} failed: ${this.detail}`;
  }
}
