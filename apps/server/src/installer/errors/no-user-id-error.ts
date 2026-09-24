import { InstallerError } from './installer-error.ts';

export class NoUserIdError extends InstallerError {
  override readonly name = 'NoUserIdError';
  constructor() {
    super('Porcelain services require a user id.');
  }
}
