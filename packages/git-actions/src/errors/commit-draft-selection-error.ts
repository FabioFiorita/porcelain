import { CommitDraftError } from './commit-draft-error.ts';

export class CommitDraftSelectionError extends CommitDraftError {
  override readonly name = 'CommitDraftSelectionError';

  constructor() {
    super('Select readable changed files to generate a commit draft.');
  }
}
