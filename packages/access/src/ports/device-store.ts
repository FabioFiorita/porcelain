import type { StoredDevice } from '../models/device.ts';

export interface DeviceStore {
  find(input: { deviceId: string }): StoredDevice | undefined;
  list(): StoredDevice[];
  markRevoked(input: { device: StoredDevice; revokedAt: string }): void;
  recordSighting(input: { device: StoredDevice }): void;
}
