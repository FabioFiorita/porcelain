export class UnsupportedFolderNameError extends Error {
  override readonly name = 'UnsupportedFolderNameError';

  constructor() {
    super('Directory contains a name that is not supported UTF-8');
  }
}
