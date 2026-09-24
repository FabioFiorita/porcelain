import { InstallerError } from './installer-error.ts';

export class RootUserError extends InstallerError {
  override readonly name = 'RootUserError';
  constructor() {
    super(
      'Refusing to manage Porcelain as root. Run this command as the user who will use Porcelain.',
    );
  }
}
