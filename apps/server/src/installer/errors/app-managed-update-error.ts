import { InstallerError } from './installer-error.ts';

export class AppManagedUpdateError extends InstallerError {
  override readonly name = 'AppManagedUpdateError';
  constructor() {
    super(
      'This server runs inside the Porcelain app, which updates it with the app; the service updater does not run here.',
    );
  }
}
