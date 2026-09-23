export class MergeExpectationMismatchError extends Error {
  override readonly name = 'MergeExpectationMismatchError';

  constructor() {
    super('A merge in progress and its merge head must be expected together');
  }
}
