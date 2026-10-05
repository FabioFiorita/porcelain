import { Schema } from 'effect';

export class InvalidPairingError extends Schema.TaggedError<InvalidPairingError>()(
  'InvalidPairingError',
  {},
) {
  override get message() {
    return 'This pairing link is not valid.';
  }
}
