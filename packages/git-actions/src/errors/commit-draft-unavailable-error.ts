import { CommitDraftError } from './commit-draft-error.ts';

export class CommitDraftUnavailableError extends CommitDraftError {
  override readonly name = 'CommitDraftUnavailableError';

  constructor() {
    super('Commit drafting is unavailable.');
  }
}
