import { InstallerError } from './installer-error.ts';

export class RuntimeInstallError extends InstallerError {
  override readonly name = 'RuntimeInstallError';
  constructor(detail: string) {
    super(`Could not install the persistent runtime: ${detail}`);
  }
}
