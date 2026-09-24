import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

export class InMemoryDeviceStore implements DeviceStore {
  private readonly devices = new Map<string, StoredDevice>();

  add(device: StoredDevice): void {
    this.devices.set(device.id, { ...device });
  }

  find(input: { deviceId: string }): StoredDevice | undefined {
    const device = this.devices.get(input.deviceId);
    return device && { ...device };
  }

  list(): StoredDevice[] {
    return [...this.devices.values()]
      .map((device) => ({ ...device }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  markRevoked(input: { device: StoredDevice; revokedAt: string }): void {
    this.change(input.device.id, (stored) => ({
      ...stored,
      revokedAt: input.revokedAt,
    }));
  }

  recordSighting(input: { device: StoredDevice }): void {
    this.change(input.device.id, (stored) => ({
      ...stored,
      lastSeenAt: input.device.lastSeenAt,
      lastSeenAddress: input.device.lastSeenAddress,
    }));
  }

  private change(
    deviceId: string,
    update: (stored: StoredDevice) => StoredDevice,
  ): void {
    [this.devices.get(deviceId)]
      .filter((stored) => stored !== undefined)
      .forEach((stored) => this.devices.set(deviceId, update(stored)));
  }
}
