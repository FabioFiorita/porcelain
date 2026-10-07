import { Schema } from 'effect';

export class UnitExistsError extends Schema.TaggedError<UnitExistsError>()(
  'UnitExistsError',
  {
    unitPath: Schema.String,
  },
) {
  override get message() {
    return `Refusing to replace the existing service unit at ${this.unitPath}.`;
  }
}
