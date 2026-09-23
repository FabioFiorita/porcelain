export class InvalidMoveError extends Error {
  override readonly name = 'InvalidMoveError';

  constructor() {
    super('An entry cannot be moved onto or into itself');
  }
}
