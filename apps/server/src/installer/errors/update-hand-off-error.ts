import { InstallerError } from './installer-error.ts';

export class UpdateHandOffError extends InstallerError {
  override readonly name = 'UpdateHandOffError';
  constructor(detail: string) {
    super(`Could not start the updater beside the running service: ${detail}`);
  }
}
