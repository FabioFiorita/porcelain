import type {
  DeviceConnection,
  DeviceConnections,
  DeviceConnectionStore,
  HeldConnection,
  ReleaseConnection,
} from '../../ports/device-connection-store.ts';

export class InMemoryDeviceConnectionStore implements DeviceConnectionStore {
  private readonly connections = new Map<string, Set<HeldConnection>>();

  insert(input: DeviceConnection): ReleaseConnection {
    const held =
      this.connections.get(input.deviceId) ?? new Set<HeldConnection>();
    held.add(input.connection);
    this.connections.set(input.deviceId, held);
    return () => {
      held.delete(input.connection);
      if (held.size === 0) this.connections.delete(input.deviceId);
    };
  }

  remove(input: DeviceConnections): void {
    const held = this.connections.get(input.deviceId) ?? new Set();
    this.connections.delete(input.deviceId);
    for (const connection of held) connection.close();
  }
}
