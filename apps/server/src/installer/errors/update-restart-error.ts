import { InstallerError } from './installer-error.ts';

export class UpdateRestartError extends InstallerError {
  override readonly name = 'UpdateRestartError';
  constructor(detail: string) {
    super(
      `Porcelain update failed before replacement and the previous service could not restart. ${detail}`,
    );
  }
}
