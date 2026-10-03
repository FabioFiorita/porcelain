export class InvalidPairingAddressError extends Error {
  override readonly name = 'InvalidPairingAddressError';
  constructor() {
    super(
      'This server does not answer at that address, so a link aimed there would not reach it.',
    );
  }
}
