export class InvalidPairingError extends Error {
  override readonly name = 'InvalidPairingError';
  constructor() {
    super('This pairing link is not valid.');
  }
}
