export class CommitDraftUnavailableError extends Error {
  override readonly name = 'CommitDraftUnavailableError';

  constructor() {
    super('Commit drafting is unavailable.');
  }
}
