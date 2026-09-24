export class CommitPlanFailedError extends Error {
  override readonly name = 'CommitPlanFailedError';

  constructor(options?: ErrorOptions) {
    super('Commit generation failed.', options);
  }
}
