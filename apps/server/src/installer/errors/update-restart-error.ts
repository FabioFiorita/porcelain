import { Schema } from 'effect';

export class UpdateRestartError extends Schema.TaggedError<UpdateRestartError>()(
  'UpdateRestartError',
  {
    detail: Schema.String,
  },
) {
  override get message() {
    return `Porcelain update failed before replacement and the previous service could not restart. ${this.detail}`;
  }
}
