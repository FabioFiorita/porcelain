export class UnsupportedDatabaseVersionError extends Error {
  override readonly name = 'UnsupportedDatabaseVersionError';
  readonly version: unknown;
  constructor(version: unknown) {
    super('Unsupported inventory database version');
    this.version = version;
  }
}
