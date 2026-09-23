import { CommitDraftError } from './commit-draft-error.ts';

export class CommitToolFailedError extends CommitDraftError {
  override readonly name = 'CommitToolFailedError';

  constructor() {
    super(
      'Commit generation failed. Check that the selected CLI is up to date and signed in.',
    );
  }
}
