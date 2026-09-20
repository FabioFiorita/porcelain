export class InvalidPairingError extends Error {
  override readonly name = 'InvalidPairingError';
  constructor() {
    // One message for expired, consumed, revoked and wrong alike: telling them
    // apart would hand an attacker an oracle, and the owner cannot act on the
    // difference anyway.
    super('This pairing link is not valid.');
  }
}
