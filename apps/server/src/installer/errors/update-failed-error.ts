import { Schema } from 'effect';

export class UpdateFailedError extends Schema.TaggedError<UpdateFailedError>()(
  'UpdateFailedError',
  {
    recovery: Schema.String,
    detail: Schema.String,
    hint: Schema.optional(Schema.String),
  },
) {
  override get message() {
    return [
      `Porcelain update failed; ${this.recovery}.`,
      this.detail,
      this.hint ?? '',
    ]
      .filter((part) => part !== '')
      .join(' ');
  }
}
