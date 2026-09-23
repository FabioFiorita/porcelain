import type { Device, PairingGrant } from '../../models/pairing.ts';

export type StoredDevice = Device & {
  secretHash: string;
  revokedAt: string | null;
};

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

export type LastSeen = {
  deviceId: string;
  lastSeenAt: string;
  lastSeenAddress: string | null;
};

export interface PairingStore {
  issueGrant(record: GrantRecord): void;
  listGrants(now: string): PairingGrant[];
  revokeGrant(id: string, now: string): boolean;
  redeem(input: {
    grantId: string;
    secret: string;
    now: string;
    device: DeviceRecord;
  }): Device | null;
  listDevices(): Device[];
  allDevices(): StoredDevice[];
  revokeDevice(id: string, now: string): boolean;
  recordLastSeen(entries: LastSeen[]): void;
}

export interface DeviceRegistry {
  add(device: StoredDevice): void;
  revoke(deviceId: string, now: string): boolean;
}
