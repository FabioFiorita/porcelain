import type { StoredDevice } from '@porcelain/access/models';
import type {
  DeviceActivityWriter,
  DeviceStore,
} from '@porcelain/access/ports';

export type HeldConnection = { close(): void };

export class CachedDeviceStore implements DeviceStore, DeviceActivityWriter {
  private readonly devices: DeviceStore;
  private readonly cached = new Map<string, StoredDevice>();
  private readonly unflushed = new Map<string, StoredDevice>();
  private readonly connections = new Map<string, Set<HeldConnection>>();

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
    const deviceId = input.device.id;
    this.devices.markRevoked(input);
    const cached = this.cached.get(deviceId);
    if (cached)
      this.cached.set(deviceId, { ...cached, revokedAt: input.revokedAt });
    this.unflushed.delete(deviceId);
    for (const connection of this.connections.get(deviceId) ?? [])
      connection.close();
    this.connections.delete(deviceId);
  }

  recordSighting(input: { device: StoredDevice }): void {
    this.cached.set(input.device.id, input.device);
    this.unflushed.set(input.device.id, input.device);
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
    const devices = [...this.unflushed.values()];
    this.unflushed.clear();
    for (const device of devices) this.devices.recordSighting({ device });
  }
}
