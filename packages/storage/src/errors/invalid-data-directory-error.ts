export class InvalidDataDirectoryError extends Error {
  override readonly name = 'InvalidDataDirectoryError';
  constructor() {
    super('An absolute data directory is required');
  }
}
