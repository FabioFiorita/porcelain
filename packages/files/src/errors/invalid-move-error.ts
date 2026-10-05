import { Schema } from 'effect';

export class InvalidMoveError extends Schema.TaggedError<InvalidMoveError>()(
  'InvalidMoveError',
  {},
) {
  override get message() {
    return 'An entry cannot be moved onto or into itself';
  }
}
