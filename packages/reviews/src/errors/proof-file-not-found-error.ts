import { Schema } from 'effect';

export class ProofFileNotFoundError extends Schema.TaggedError<ProofFileNotFoundError>()(
  'ProofFileNotFoundError',
  {},
) {
  override get message() {
    return 'Proof file not found';
  }
}
