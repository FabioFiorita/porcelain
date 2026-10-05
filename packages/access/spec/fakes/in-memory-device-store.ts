import { Effect } from 'effect';
import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

type Sighting = Pick<StoredDevice, 'lastSeenAt' | 'lastSeenAddress'>;

export class InMemoryDeviceStore implements DeviceStore {
  private readonly devices = new Map<string, StoredDevice>();
  private readonly revocations = new Map<string, string>();
  private readonly sightings = new Map<string, Sighting>();
  private readonly trust = new Map<string, true | undefined>();

  add(device: StoredDevice): void {
    this.devices.set(device.id, { ...device });
    this.revocations.delete(device.id);
    this.sightings.delete(device.id);
    this.trust.set(device.id, device.trusted || undefined);
  }

  find(input: { deviceId: string }): Effect.Effect<StoredDevice | undefined> {
    return Effect.sync(() => {
      const device = this.devices.get(input.deviceId);
      return device && this.current(device);
    });
  }

  list(): Effect.Effect<StoredDevice[]> {
    return Effect.sync(() => {
      return [...this.devices.values()]
        .map((device) => this.current(device))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    });
  }

  markRevoked(input: {
    device: StoredDevice;
    revokedAt: string;
  }): Effect.Effect<void> {
    return Effect.sync(() => {
      this.revocations.set(input.device.id, input.revokedAt);
    });
  }

  recordSighting(input: { device: StoredDevice }): Effect.Effect<void> {
    return Effect.sync(() => {
      this.sightings.set(input.device.id, {
        lastSeenAt: input.device.lastSeenAt,
        lastSeenAddress: input.device.lastSeenAddress,
      });
    });
  }

  recordTrust(input: {
    device: StoredDevice;
    trusted: boolean;
  }): Effect.Effect<void> {
    return Effect.sync(() => {
      this.trust.set(input.device.id, input.trusted || undefined);
    });
  }

  private current(device: StoredDevice): StoredDevice {
    return {
      ...device,
      ...this.sightings.get(device.id),
      trusted: this.trust.get(device.id),
      revokedAt: this.revocations.get(device.id) ?? device.revokedAt,
    };
  }
}
