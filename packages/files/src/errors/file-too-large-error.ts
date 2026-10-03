export class FileTooLargeError extends Error {
  override readonly name = 'FileTooLargeError';

  constructor() {
    super('File exceeds the read limit');
  }
}
