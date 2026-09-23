import type { StoredDevice } from './device.ts';

export type PairingGrant = {
  id: string;
  label: string;
  addresses: string[];
  createdAt: string;
  expiresAt: string;
};

export type StoredPairingGrant = PairingGrant & {
  secretHash: string;
  redeemedAt?: string;
  revokedAt?: string;
};

export type PairingRedemption = {
  grantId: string;
  redeemedAt: string;
  device: StoredDevice;
};
