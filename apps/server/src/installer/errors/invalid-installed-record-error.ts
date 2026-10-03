import { InstallerError } from './installer-error.ts';

export class InvalidInstalledRecordError extends InstallerError {
  override readonly name = 'InvalidInstalledRecordError';
  constructor() {
    super(
      'The installed service record is invalid. Preserve the service directory for manual recovery.',
    );
  }
}
