export class PathNotFoundError extends Error {
  override readonly name = 'PathNotFoundError';

  constructor() {
    super('Path not found');
  }
}
