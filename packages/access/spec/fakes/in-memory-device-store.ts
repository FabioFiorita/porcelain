import type { DeviceSighting, StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

export class InMemoryDeviceStore implements DeviceStore {
  readonly devices = new Map<string, StoredDevice>();

  add(device: StoredDevice): void {
    if (this.devices.has(device.id))
      throw new Error(`Device ${device.id} already exists`);
    this.devices.set(device.id, { ...device });
  }

  find(deviceId: string): StoredDevice | undefined {
    const device = this.devices.get(deviceId);
    return device ? { ...device } : undefined;
  }

  list(): StoredDevice[] {
    return [...this.devices.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((device) => ({ ...device }));
  }

  markRevoked(deviceId: string, revokedAt: string): void {
    const device = this.devices.get(deviceId);
    if (device) this.devices.set(deviceId, { ...device, revokedAt });
  }

  recordSightings(sightings: readonly DeviceSighting[]): void {
    for (const sighting of sightings) {
      const device = this.devices.get(sighting.deviceId);
      if (!device) continue;
      const { lastSeenAddress: _previous, ...rest } = device;
      this.devices.set(sighting.deviceId, {
        ...rest,
        lastSeenAt: sighting.seenAt,
        ...(sighting.address === undefined
          ? {}
          : { lastSeenAddress: sighting.address }),
      });
    }
  }
}
