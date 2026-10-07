import { Schema } from 'effect';

export class UpdateHandOffError extends Schema.TaggedError<UpdateHandOffError>()(
  'UpdateHandOffError',
  {
    detail: Schema.String,
  },
) {
  override get message() {
    return `Could not start the updater beside the running service: ${this.detail}`;
  }
}
