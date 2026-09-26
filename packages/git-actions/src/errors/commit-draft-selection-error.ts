export class CommitDraftSelectionError extends Error {
  override readonly name = 'CommitDraftSelectionError';

  constructor() {
    super('Select readable changed files to generate a commit draft.');
  }
}
