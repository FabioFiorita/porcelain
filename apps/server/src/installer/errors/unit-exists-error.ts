import { InstallerError } from './installer-error.ts';

export class UnitExistsError extends InstallerError {
  override readonly name = 'UnitExistsError';
  constructor(unitPath: string) {
    super(`Refusing to replace the existing service unit at ${unitPath}.`);
  }
}
