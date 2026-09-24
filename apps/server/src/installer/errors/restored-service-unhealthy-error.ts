import { InstallerError } from './installer-error.ts';

export class RestoredServiceUnhealthyError extends InstallerError {
  override readonly name = 'RestoredServiceUnhealthyError';
  constructor() {
    super(
      'The previous service was restored after an interrupted update but did not become healthy.',
    );
  }
}
