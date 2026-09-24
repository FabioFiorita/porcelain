import { InstallerError } from './installer-error.ts';

export class UnrecognizedUnitError extends InstallerError {
  override readonly name = 'UnrecognizedUnitError';
  constructor(unitPath: string) {
    super(`Refusing to remove an unrecognized service unit at ${unitPath}.`);
  }
}
