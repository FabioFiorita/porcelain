import { Schema } from 'effect';

export class ProofTooLargeError extends Schema.TaggedError<ProofTooLargeError>()(
  'ProofTooLargeError',
  {},
) {
  override get message() {
    return 'A proof file, or the proof files together, are over their size limit';
  }
}
