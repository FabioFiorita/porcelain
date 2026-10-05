import { Schema } from 'effect';

export class InvalidPairingAddressError extends Schema.TaggedError<InvalidPairingAddressError>()(
  'InvalidPairingAddressError',
  {},
) {
  override get message() {
    return 'This server does not answer at that address, so a link aimed there would not reach it.';
  }
}
