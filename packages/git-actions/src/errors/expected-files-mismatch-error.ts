export class ExpectedFilesMismatchError extends Error {
  override readonly name = 'ExpectedFilesMismatchError';

  constructor() {
    super('The expected files do not match the selected paths');
  }
}
