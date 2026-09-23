import { CommitDraftError } from './commit-draft-error.ts';

export class CommitGenerationFailedError extends CommitDraftError {
  override readonly name = 'CommitGenerationFailedError';

  constructor() {
    super('Commit generation failed.');
  }
}
