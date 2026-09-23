import { CommitDraftError } from './commit-draft-error.ts';

export class UnsupportedCommitModelError extends CommitDraftError {
  override readonly name = 'UnsupportedCommitModelError';

  constructor() {
    super('Unsupported commit model.');
  }
}
