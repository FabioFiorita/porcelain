import { InstallerError } from './installer-error.ts';

export class ServiceCommandFailedError extends InstallerError {
  override readonly name = 'ServiceCommandFailedError';
  constructor(description: string, detail: string) {
    super(`${description} failed: ${detail}`);
  }
}
