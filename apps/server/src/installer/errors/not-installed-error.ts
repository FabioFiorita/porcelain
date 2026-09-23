export class NotInstalledError extends Error {
  override readonly name = 'NotInstalledError';
  constructor() {
    super(
      'Porcelain service is not installed. Run `porcelain service install`.',
    );
  }
}
