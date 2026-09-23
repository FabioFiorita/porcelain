import type { DeviceSighting, StoredDevice } from '../models/device.ts';

export interface DeviceStore {
  find(deviceId: string): StoredDevice | undefined;
  list(): StoredDevice[];
  markRevoked(deviceId: string, revokedAt: string): void;
  recordSightings(sightings: readonly DeviceSighting[]): void;
}
