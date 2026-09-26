export class CommitToolFailedError extends Error {
  override readonly name = 'CommitToolFailedError';

  constructor() {
    super(
      'Commit generation failed. Check that the selected CLI is up to date and signed in.',
    );
  }
}
