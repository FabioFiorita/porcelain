export class InvalidLineRangeError extends Error {
  override readonly name = 'InvalidLineRangeError';

  constructor() {
    super('The line range ends before it starts');
  }
}
