import type { StoredDevice } from '@porcelain/access/models';
import type { DeviceStore } from '@porcelain/access/ports';

export class CachedDeviceStore implements DeviceStore {
  private readonly devices: DeviceStore;
  private readonly cached = new Map<string, StoredDevice>();

  constructor(devices: DeviceStore) {
    this.devices = devices;
  }

  find(input: { deviceId: string }): StoredDevice | undefined {
    const cached = this.cached.get(input.deviceId);
    if (cached) return cached;
    const stored = this.devices.find(input);
    if (stored) this.cached.set(input.deviceId, stored);
    return stored;
  }

  list(): StoredDevice[] {
    return this.devices.list();
  }

  markRevoked(input: { device: StoredDevice; revokedAt: string }): void {
    this.devices.markRevoked(input);
    this.cached.set(input.device.id, {
      ...input.device,
      revokedAt: input.revokedAt,
    });
  }

  recordSighting(input: { device: StoredDevice }): void {
    this.devices.recordSighting(input);
    this.cached.set(input.device.id, input.device);
  }
}
