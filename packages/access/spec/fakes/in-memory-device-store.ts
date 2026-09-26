import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

type Sighting = Pick<StoredDevice, 'lastSeenAt' | 'lastSeenAddress'>;

export class InMemoryDeviceStore implements DeviceStore {
  private readonly devices = new Map<string, StoredDevice>();
  private readonly revocations = new Map<string, string>();
  private readonly sightings = new Map<string, Sighting>();

  add(device: StoredDevice): void {
    this.devices.set(device.id, { ...device });
    this.revocations.delete(device.id);
    this.sightings.delete(device.id);
  }

  find(input: { deviceId: string }): StoredDevice | undefined {
    const device = this.devices.get(input.deviceId);
    return device && this.current(device);
  }

  list(): StoredDevice[] {
    return [...this.devices.values()]
      .map((device) => this.current(device))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  markRevoked(input: { device: StoredDevice; revokedAt: string }): void {
    this.revocations.set(input.device.id, input.revokedAt);
  }

  recordSighting(input: { device: StoredDevice }): void {
    this.sightings.set(input.device.id, {
      lastSeenAt: input.device.lastSeenAt,
      lastSeenAddress: input.device.lastSeenAddress,
    });
  }

  private current(device: StoredDevice): StoredDevice {
    return {
      ...device,
      ...this.sightings.get(device.id),
      revokedAt: this.revocations.get(device.id) ?? device.revokedAt,
    };
  }
}
