export class FilePreferenceLimitError extends Error {
  constructor() {
    super('File preference limit reached');
    this.name = 'FilePreferenceLimitError';
  }
}
