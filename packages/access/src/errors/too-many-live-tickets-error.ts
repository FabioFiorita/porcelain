export class TooManyLiveTicketsError extends Error {
  override readonly name = 'TooManyLiveTicketsError';

  constructor() {
    super('Too many live tickets are waiting to be used. Try again shortly.');
  }
}
