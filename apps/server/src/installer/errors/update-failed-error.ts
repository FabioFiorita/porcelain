import { InstallerError } from './installer-error.ts';

export class UpdateFailedError extends InstallerError {
  override readonly name = 'UpdateFailedError';
  constructor(recovery: string, detail: string, hint: string | undefined) {
    super(
      [`Porcelain update failed; ${recovery}.`, detail, hint ?? '']
        .filter((part) => part !== '')
        .join(' '),
    );
  }
}
