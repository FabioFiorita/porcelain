import { Schema } from 'effect';

export class UnrecognizedUnitError extends Schema.TaggedError<UnrecognizedUnitError>()(
  'UnrecognizedUnitError',
  {
    unitPath: Schema.String,
  },
) {
  override get message() {
    return `Refusing to remove an unrecognized service unit at ${this.unitPath}.`;
  }
}
