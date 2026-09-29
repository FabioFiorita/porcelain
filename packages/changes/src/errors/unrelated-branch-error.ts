export class UnrelatedBranchError extends Error {
  override readonly name = 'UnrelatedBranchError';

  constructor() {
    super('The branch shares no history with its base');
  }
}
