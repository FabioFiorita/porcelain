import { InstallerError } from './installer-error.ts';

export class UpdatedServiceUnhealthyError extends InstallerError {
  override readonly name = 'UpdatedServiceUnhealthyError';
  constructor() {
    super('The updated service did not become healthy.');
  }
}
