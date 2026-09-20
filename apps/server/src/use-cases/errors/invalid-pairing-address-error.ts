export class InvalidPairingAddressError extends Error {
  override readonly name = 'InvalidPairingAddressError';
  constructor(address: string) {
    super(
      address === 'none'
        ? 'A pairing link needs at least one address: pass --address http://<host>:<port>.'
        : `This server does not answer at ${address}, so a link aimed there would not reach it.`,
    );
  }
}
