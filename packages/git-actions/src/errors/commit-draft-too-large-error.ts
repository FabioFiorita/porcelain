export class CommitDraftTooLargeError extends Error {
  override readonly name = 'CommitDraftTooLargeError';

  constructor() {
    super('Select fewer files to generate a commit draft.');
  }
}
