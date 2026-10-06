import { Schema } from 'effect';

export class UnknownProofFileError extends Schema.TaggedError<UnknownProofFileError>()(
  'UnknownProofFileError',
  {},
) {
  override get message() {
    return 'A proofId names no image or video of the current review';
  }
}
