import type { Device, PairingGrant } from '../models/pairing.ts';

export type GrantRecord = {
  id: string;
  label: string;
  secretHash: string;
  addresses: string[];
  createdAt: string;
  expiresAt: string;
};

export type DeviceRecord = {
  id: string;
  label: string;
  platform: string;
  secretHash: string;
  createdAt: string;
};

export interface PairingGrantStore {
  issueGrant(record: GrantRecord): void;
  listGrants(now: string): PairingGrant[];
  revokeGrant(id: string, now: string): boolean;
  redeem(input: {
    grantId: string;
    secret: string;
    now: string;
    device: DeviceRecord;
  }): Device | undefined;
}
