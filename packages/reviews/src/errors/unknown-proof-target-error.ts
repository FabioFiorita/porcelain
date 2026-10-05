import { Schema } from 'effect';

export class UnknownProofTargetError extends Schema.TaggedError<UnknownProofTargetError>()(
  'UnknownProofTargetError',
  {},
) {
  override get message() {
    return 'A check or asset names a layer or step the review does not have; a step also needs its layer';
  }
}
