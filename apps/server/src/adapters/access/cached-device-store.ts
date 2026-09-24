import type { DeviceSighting, StoredDevice } from '@porcelain/access/models';
import type { DeviceActivityStore, DeviceStore } from '@porcelain/access/ports';

export type HeldConnection = { close(): void };

export class CachedDeviceStore implements DeviceStore, DeviceActivityStore {
  private readonly deviceStore: DeviceStore;
  private readonly devices = new Map<string, StoredDevice>();
  private readonly unflushed = new Map<string, DeviceSighting>();
  private readonly connections = new Map<string, Set<HeldConnection>>();

  constructor(deviceStore: DeviceStore) {
    this.deviceStore = deviceStore;
  }

  find(deviceId: string): StoredDevice | undefined {
    const cached = this.devices.get(deviceId);
    if (cached) return cached;
    const stored = this.deviceStore.find(deviceId);
    if (stored) this.devices.set(deviceId, stored);
    return stored;
  }

  list(): StoredDevice[] {
    return this.deviceStore.list();
  }

  markRevoked(deviceId: string, revokedAt: string): void {
    this.deviceStore.markRevoked(deviceId, revokedAt);
    const cached = this.devices.get(deviceId);
    if (cached) this.devices.set(deviceId, { ...cached, revokedAt });
    this.unflushed.delete(deviceId);
    for (const connection of this.connections.get(deviceId) ?? [])
      connection.close();
    this.connections.delete(deviceId);
  }

  recordSightings(sightings: readonly DeviceSighting[]): void {
    for (const sighting of sightings) {
      const cached = this.find(sighting.deviceId);
      if (!cached) continue;
      const { lastSeenAddress: _previous, ...device } = cached;
      this.devices.set(sighting.deviceId, {
        ...device,
        lastSeenAt: sighting.seenAt,
        ...(sighting.address === undefined
          ? {}
          : { lastSeenAddress: sighting.address }),
      });
      this.unflushed.set(sighting.deviceId, sighting);
    }
  }

  hold(deviceId: string, connection: HeldConnection): () => void {
    const held = this.connections.get(deviceId) ?? new Set<HeldConnection>();
    held.add(connection);
    this.connections.set(deviceId, held);
    return () => {
      held.delete(connection);
      if (held.size === 0) this.connections.delete(deviceId);
    };
  }

  flush(): void {
    const sightings = [...this.unflushed.values()];
    this.unflushed.clear();
    this.deviceStore.recordSightings(sightings);
  }
}
