import { InstallerError } from './installer-error.ts';

export class ManagementLockUnavailableError extends InstallerError {
  override readonly name = 'ManagementLockUnavailableError';
  constructor() {
    super('Could not acquire the Porcelain service management lock.');
  }
}
