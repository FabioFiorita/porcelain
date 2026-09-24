import { InstallerError } from './installer-error.ts';

export class InstallCleanupError extends InstallerError {
  override readonly name = 'InstallCleanupError';
  constructor(detail: string) {
    super(
      `Porcelain installation failed and the service could not be stopped safely. The runtime and backup were retained. ${detail}`,
    );
  }
}
