import { Schema } from 'effect';

export class TooManyPairingAttemptsError extends Schema.TaggedError<TooManyPairingAttemptsError>()(
  'TooManyPairingAttemptsError',
  {},
) {
  override get message() {
    return 'Too many pairing attempts. Wait a moment and try again.';
  }
}
