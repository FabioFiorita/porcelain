export class UnsupportedFilesystemIdentityError extends Error {
  override readonly name = 'UnsupportedFilesystemIdentityError';
  constructor() {
    super(
      'Filesystem birth time is required for conservative identity matching',
    );
  }
}
