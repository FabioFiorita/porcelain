import { InstallerError } from './installer-error.ts';

export class AlreadyInstalledError extends InstallerError {
  override readonly name = 'AlreadyInstalledError';
  constructor() {
    super(
      'Porcelain is already installed; run porcelain service update to change it.',
    );
  }
}
