import { InstallerError } from './installer-error.ts';

export class InvalidUpdateJournalError extends InstallerError {
  override readonly name = 'InvalidUpdateJournalError';
  constructor(path: string) {
    super(
      `The interrupted update record at ${path} is invalid. Preserve it and the service runtime for manual recovery.`,
    );
  }
}
