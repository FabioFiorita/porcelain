import type {
  DeviceConnections,
  HeldConnection,
} from '../../ports/device-connections.ts';

export class HeldDeviceConnections implements DeviceConnections {
  private readonly connections = new Map<string, Set<HeldConnection>>();

  hold(input: { deviceId: string; connection: HeldConnection }): () => void {
    const held =
      this.connections.get(input.deviceId) ?? new Set<HeldConnection>();
    held.add(input.connection);
    this.connections.set(input.deviceId, held);
    return () => {
      held.delete(input.connection);
      if (held.size === 0) this.connections.delete(input.deviceId);
    };
  }

  close(input: { deviceId: string }): void {
    const held = this.connections.get(input.deviceId) ?? new Set();
    this.connections.delete(input.deviceId);
    for (const connection of held) connection.close();
  }
}
