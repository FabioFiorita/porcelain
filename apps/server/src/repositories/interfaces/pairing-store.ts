import type { Device, PairingGrant } from '../../models/pairing.ts';

/** A device as the authentication cache needs it, digest included. */
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
  /**
   * Consume a grant and create its device in one immediate transaction: a
   * redemption that cannot finish must not burn the link. Returns null when the
   * conditional update matched nothing, which is what a second redeemer sees.
   */
  redeem(input: {
    grantId: string;
    secret: string;
    now: string;
    device: DeviceRecord;
  }): Device | null;
  listDevices(): Device[];
  allDevices(): StoredDevice[];
  revokeDevice(id: string, now: string): boolean;
  /** Writes only last-seen fields, and never to a revoked row. */
  recordLastSeen(entries: LastSeen[]): void;
}

/**
 * The in-memory side of device authentication, as the use case needs it: a
 * redemption must be usable on the device's next request, and a revocation must
 * take effect without waiting for anything to expire.
 */
export interface DeviceRegistry {
  add(device: StoredDevice): void;
  revoke(deviceId: string, now: string): boolean;
}
