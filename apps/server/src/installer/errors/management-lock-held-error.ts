import { InstallerError } from './installer-error.ts';

export class ManagementLockHeldError extends InstallerError {
  override readonly name = 'ManagementLockHeldError';
  constructor() {
    super(
      'Another Porcelain service command is already running. Wait for it to finish.',
    );
  }
}
