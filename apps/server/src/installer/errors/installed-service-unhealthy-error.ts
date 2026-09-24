import { InstallerError } from './installer-error.ts';

export class InstalledServiceUnhealthyError extends InstallerError {
  override readonly name = 'InstalledServiceUnhealthyError';
  constructor() {
    super('The installed service did not become healthy.');
  }
}
