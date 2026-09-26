import type {
  DeviceKey,
  DeviceSighting,
  StoredDevice,
} from '../models/device.ts';

export interface DeviceSightingStore {
  find(input: DeviceKey): StoredDevice | undefined;
  save(input: DeviceSighting): void;
  take(): StoredDevice[];
  remove(input: DeviceKey): void;
}
