export class TooManyPairingAttemptsError extends Error {
  override readonly name = 'TooManyPairingAttemptsError';

  constructor() {
    super('Too many pairing attempts. Wait a moment and try again.');
  }
}
