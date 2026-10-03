export class ProofFileNotFoundError extends Error {
  override readonly name = 'ProofFileNotFoundError';

  constructor() {
    super('Proof file not found');
  }
}
