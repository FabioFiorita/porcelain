export type RevokePairingGrantInput = { id: string };

export type RevokePairingGrantResult =
  | { kind: 'revoked' }
  | { kind: 'not-revoked' };
