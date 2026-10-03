export class DuplicateExpectedFileError extends Error {
  override readonly name = 'DuplicateExpectedFileError';

  constructor() {
    super('Each expected file may appear only once');
  }
}
