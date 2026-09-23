import { CommitDraftError } from './commit-draft-error.ts';

export class CommitToolMissingError extends CommitDraftError {
  override readonly name = 'CommitToolMissingError';

  constructor() {
    super('The selected coding CLI is not installed.');
  }
}
