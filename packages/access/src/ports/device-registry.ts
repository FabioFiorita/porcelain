import type { StoredDevice } from './device-store.ts';

export interface DeviceRegistry {
  add(device: StoredDevice): void;
  revoke(deviceId: string, now: string): boolean;
}
