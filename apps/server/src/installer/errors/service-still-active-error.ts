import { InstallerError } from './installer-error.ts';

export class ServiceStillActiveError extends InstallerError {
  override readonly name = 'ServiceStillActiveError';
  constructor(after: 'stop' | 'disable') {
    super(`porcelain.service remained active after ${after}.`);
  }
}
