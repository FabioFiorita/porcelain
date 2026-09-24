import { InstallerError } from './installer-error.ts';

export class UpdateFailedError extends InstallerError {
  override readonly name = 'UpdateFailedError';
  constructor(recovery: string, detail: string) {
    super(`Porcelain update failed; ${recovery}. ${detail}`.trim());
  }
}
