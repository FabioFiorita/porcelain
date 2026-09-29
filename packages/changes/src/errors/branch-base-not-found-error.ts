export class BranchBaseNotFoundError extends Error {
  override readonly name = 'BranchBaseNotFoundError';

  constructor() {
    super('Base branch not found');
  }
}
