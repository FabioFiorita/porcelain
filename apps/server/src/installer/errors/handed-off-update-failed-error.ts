import { Schema } from 'effect';

export class HandedOffUpdateFailedError extends Schema.TaggedError<HandedOffUpdateFailedError>()(
  'HandedOffUpdateFailedError',
  {
    target: Schema.String,
    reason: Schema.String,
  },
) {
  override get message() {
    return `The update to Porcelain ${this.target} failed: ${this.reason}`;
  }
}
