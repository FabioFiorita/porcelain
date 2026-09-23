export class IncompleteDiffReadError extends Error {
  override readonly name = 'IncompleteDiffReadError';

  constructor() {
    super('Diff read returned fewer results than requested');
  }
}
