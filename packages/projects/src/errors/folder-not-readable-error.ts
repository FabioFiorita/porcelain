export class FolderNotReadableError extends Error {
  override readonly name = 'FolderNotReadableError';

  constructor() {
    super('Path could not be read');
  }
}
