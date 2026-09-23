export class FilePreferenceLimitError extends Error {
  override readonly name = 'FilePreferenceLimitError';

  constructor() {
    super('File preference limit reached');
  }
}
