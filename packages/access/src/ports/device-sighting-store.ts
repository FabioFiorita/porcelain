import type { StoredDevice } from '../models/device.ts';

export interface DeviceSightingStore {
  find(input: { deviceId: string }): StoredDevice | undefined;
  save(input: { device: StoredDevice }): void;
  take(): StoredDevice[];
  remove(input: { deviceId: string }): void;
}
