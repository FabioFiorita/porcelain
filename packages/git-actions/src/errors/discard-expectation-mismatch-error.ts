export class DiscardExpectationMismatchError extends Error {
  override readonly name = 'DiscardExpectationMismatchError';

  constructor() {
    super('A discard expects exactly the discarded path');
  }
}
