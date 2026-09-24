import { InstallerError } from './installer-error.ts';

export class ServiceDowngradeError extends InstallerError {
  override readonly name = 'ServiceDowngradeError';
  constructor(installed: string, candidate: string) {
    super(
      `Refusing to replace Porcelain ${installed} with older ${candidate}. Run again with --allow-downgrade to continue.`,
    );
  }
}
