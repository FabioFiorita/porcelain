export class UnsupportedPathEncodingError extends Error {
  override readonly name = 'UnsupportedPathEncodingError';

  constructor(options?: ErrorOptions) {
    super('Git paths require valid UTF-8', options);
  }
}
