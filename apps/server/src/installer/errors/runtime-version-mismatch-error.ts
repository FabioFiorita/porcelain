import { Schema } from 'effect';

export class RuntimeVersionMismatchError extends Schema.TaggedError<RuntimeVersionMismatchError>()(
  'RuntimeVersionMismatchError',
  {
    reported: Schema.optional(Schema.String),
    expected: Schema.String,
  },
) {
  override get message() {
    return `Persistent runtime reported ${this.reported ?? 'no version'} instead of ${this.expected}.`;
  }
}
