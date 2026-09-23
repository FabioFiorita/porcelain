export class InvalidUpdateJournalError extends Error {
  override readonly name = 'InvalidUpdateJournalError';
  constructor(path: string) {
    super(
      `The interrupted update record at ${path} is invalid. Preserve it and the service runtime for manual recovery.`,
    );
  }
}
