export type RevokeAccessInput = { id: string };

export type RevokeAccessResult =
  | { revoked: true; kind: 'grant' | 'device' }
  | { revoked: false };
