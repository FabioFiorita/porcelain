export class DataDirectoryOwnedError extends Error {
  constructor(cause: unknown) {
    super(
      'The data directory has an ownership file. See the startup recovery instructions.',
      { cause },
    );
    this.name = 'DataDirectoryOwnedError';
  }
}
