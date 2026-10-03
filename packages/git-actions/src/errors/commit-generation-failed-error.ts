export class CommitGenerationFailedError extends Error {
  override readonly name = 'CommitGenerationFailedError';

  constructor() {
    super('Commit generation failed.');
  }
}
