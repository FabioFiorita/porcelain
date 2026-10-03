export class UnbornBranchError extends Error {
  override readonly name = 'UnbornBranchError';

  constructor() {
    super('The branch has no commits yet');
  }
}
