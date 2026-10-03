import { InstallerError } from './installer-error.ts';

export class UpdateRecoveryError extends InstallerError {
  override readonly name = 'UpdateRecoveryError';
  constructor(detail: string) {
    super(
      `Porcelain update failed and automatic recovery could not finish. The update record, previous runtime, and database backup were retained. ${detail}`,
    );
  }
}
