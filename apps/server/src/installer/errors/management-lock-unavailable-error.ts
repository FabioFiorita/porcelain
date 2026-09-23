export class ManagementLockUnavailableError extends Error {
  override readonly name = 'ManagementLockUnavailableError';
  constructor() {
    super('Could not acquire the Porcelain service management lock.');
  }
}
