import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

export class InMemoryDeviceStore implements DeviceStore {
  private readonly devices = new Map<string, StoredDevice>();

  add(device: StoredDevice): void {
    this.devices.set(device.id, device);
  }

  find(input: { deviceId: string }): StoredDevice | undefined {
    return this.devices.get(input.deviceId);
  }

  list(): StoredDevice[] {
    return [...this.devices.values()];
  }

  markRevoked(input: { device: StoredDevice; revokedAt: string }): void {
    this.devices.set(input.device.id, {
      ...input.device,
      revokedAt: input.revokedAt,
    });
  }

  recordSighting(input: { device: StoredDevice }): void {
    this.devices.set(input.device.id, input.device);
  }
}
