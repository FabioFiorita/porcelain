import type {
  DeviceKey,
  DeviceRevocation,
  DeviceSighting,
  StoredDevice,
} from '../models/device.ts';

export interface DeviceStore {
  find(input: DeviceKey): StoredDevice | undefined;
  list(): StoredDevice[];
  markRevoked(input: DeviceRevocation): void;
  recordSighting(input: DeviceSighting): void;
}
