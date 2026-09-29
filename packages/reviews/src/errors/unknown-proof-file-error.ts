export class UnknownProofFileError extends Error {
  override readonly name = 'UnknownProofFileError';

  constructor() {
    super('A proofId names no image or video of the current review');
  }
}
