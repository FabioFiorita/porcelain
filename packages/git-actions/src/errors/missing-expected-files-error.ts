export class MissingExpectedFilesError extends Error {
  override readonly name = 'MissingExpectedFilesError';

  constructor() {
    super('This action needs the files the client expects');
  }
}
