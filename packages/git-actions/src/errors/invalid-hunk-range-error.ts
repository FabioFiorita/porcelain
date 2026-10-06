import { Schema } from 'effect';

export class InvalidHunkRangeError extends Schema.TaggedError<InvalidHunkRangeError>()(
  'InvalidHunkRangeError',
  {},
) {
  override get message() {
    return 'The hunk ends before it starts';
  }
}
