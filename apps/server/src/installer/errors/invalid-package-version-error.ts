import { InstallerError } from './installer-error.ts';

export class InvalidPackageVersionError extends InstallerError {
  override readonly name = 'InvalidPackageVersionError';
  constructor(version: string) {
    super(`Invalid package version: ${version}`);
  }
}
