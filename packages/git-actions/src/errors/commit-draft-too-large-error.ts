import { CommitDraftError } from './commit-draft-error.ts';

export class CommitDraftTooLargeError extends CommitDraftError {
  override readonly name = 'CommitDraftTooLargeError';

  constructor() {
    super('Select fewer files to generate a commit draft.');
  }
}
