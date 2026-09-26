export class UnsupportedCommitModelError extends Error {
  override readonly name = 'UnsupportedCommitModelError';

  constructor() {
    super('Unsupported commit model.');
  }
}
