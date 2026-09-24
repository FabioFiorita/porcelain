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
  redeemedAt?: string | undefined;
  revokedAt?: string | undefined;
};

export type PairingRedemption = {
  grant: StoredPairingGrant;
  redeemedAt: string;
  device: StoredDevice;
};

export type PairingGrantKey = { grantId: string };

export type NewPairingGrants = { grants: readonly StoredPairingGrant[] };

export type PairingGrantRevocation = {
  grant: StoredPairingGrant;
  revokedAt: string;
};
