import type { Device } from '../models/pairing.ts';

export type StoredDevice = Device & {
  secretHash: string;
  revokedAt?: string;
};

export type LastSeen = {
  deviceId: string;
  lastSeenAt: string;
  lastSeenAddress: string | null;
};

export interface DeviceStore {
  listDevices(): Device[];
  allDevices(): StoredDevice[];
  revokeDevice(id: string, now: string): boolean;
  recordLastSeen(entries: LastSeen[]): void;
}
