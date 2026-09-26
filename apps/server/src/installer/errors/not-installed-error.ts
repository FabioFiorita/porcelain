import { InstallerError } from './installer-error.ts';

export class NotInstalledError extends InstallerError {
  override readonly name = 'NotInstalledError';
  constructor() {
    super(
      'Porcelain service is not installed. Run `porcelain service install`.',
    );
  }
}
