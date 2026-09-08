export class GitInspectionTimeoutError extends Error {
  override readonly name = 'GitInspectionTimeoutError';

  constructor(cause: unknown) {
    super('Git inspection deadline exceeded', { cause });
  }
}
