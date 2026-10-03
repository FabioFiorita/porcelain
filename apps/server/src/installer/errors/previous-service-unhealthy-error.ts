import { InstallerError } from './installer-error.ts';

export class PreviousServiceUnhealthyError extends InstallerError {
  override readonly name = 'PreviousServiceUnhealthyError';
  constructor() {
    super('The previous service was restarted but did not become healthy.');
  }
}
