export type RevokeDeviceInput = { id: string };

export type RevokeDeviceResult = { kind: 'revoked' } | { kind: 'not-revoked' };
