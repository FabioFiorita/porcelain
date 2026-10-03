export class PathNotReadableError extends Error {
  override readonly name = 'PathNotReadableError';

  constructor() {
    super('Path could not be read');
  }
}
