export class FolderNotFoundError extends Error {
  override readonly name = 'FolderNotFoundError';

  constructor() {
    super('Path not found');
  }
}
