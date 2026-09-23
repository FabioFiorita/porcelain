import { CommitDraftError } from './commit-draft-error.ts';

export class CommitGroupsMismatchError extends CommitDraftError {
  override readonly name = 'CommitGroupsMismatchError';

  constructor() {
    super(
      'The generated groups did not cover the selected files. Generate again or write the message manually.',
    );
  }
}
