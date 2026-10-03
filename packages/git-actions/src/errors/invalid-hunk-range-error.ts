export class InvalidHunkRangeError extends Error {
  override readonly name = 'InvalidHunkRangeError';

  constructor() {
    super('The hunk ends before it starts');
  }
}
