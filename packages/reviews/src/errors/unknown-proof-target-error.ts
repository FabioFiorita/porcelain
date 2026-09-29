export class UnknownProofTargetError extends Error {
  override readonly name = 'UnknownProofTargetError';

  constructor() {
    super(
      'A check or asset names a layer or step the review does not have; a step also needs its layer',
    );
  }
}
