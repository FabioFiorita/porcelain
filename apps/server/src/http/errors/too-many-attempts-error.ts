export class TooManyAttemptsError extends Error {
  override readonly name = 'TooManyAttemptsError';
  constructor() {
    super('Too many pairing attempts. Wait a moment and try again.');
  }
}
