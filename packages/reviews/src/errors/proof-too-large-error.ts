export class ProofTooLargeError extends Error {
  override readonly name = 'ProofTooLargeError';

  constructor() {
    super(
      'A proof file, or the proof files together, are over their size limit',
    );
  }
}
