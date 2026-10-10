import { Schema } from 'effect';

export class InvalidDecisionBoxError extends Schema.TaggedError<InvalidDecisionBoxError>()(
  'InvalidDecisionBoxError',
  {},
) {
  override get message() {
    return 'A decision box must name a layer and be the only decision box for that layer';
  }
}
