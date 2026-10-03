export class UnsupportedTextError extends Error {
  override readonly name = 'UnsupportedTextError';

  constructor() {
    super('File is not supported UTF-8 text');
  }
}
