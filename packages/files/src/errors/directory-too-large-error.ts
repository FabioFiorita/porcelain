export class DirectoryTooLargeError extends Error {
  override readonly name = 'DirectoryTooLargeError';

  constructor() {
    super('Directory exceeds the listing limit');
  }
}
