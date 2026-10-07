import { Effect, Layer } from 'effect';
import {
  type DeviceConnection,
  type DeviceConnections,
  DeviceConnectionStore,
  type HeldConnection,
  type ReleaseConnection,
} from '../../ports/device-connection-store.ts';

export const inMemoryDeviceConnectionStoreLayer = Layer.effect(
  DeviceConnectionStore,
  Effect.sync(() => {
    const connections = new Map<string, Set<HeldConnection>>();
    const removed = new Set<string>();
    return {
      insert(input: DeviceConnection): ReleaseConnection {
        if (removed.has(input.deviceId)) {
          input.connection.close();
          return () => undefined;
        }
        const held =
          connections.get(input.deviceId) ?? new Set<HeldConnection>();
        held.add(input.connection);
        connections.set(input.deviceId, held);
        return () => {
          held.delete(input.connection);
          if (held.size === 0) connections.delete(input.deviceId);
        };
      },
      remove(input: DeviceConnections): void {
        removed.add(input.deviceId);
        const held = connections.get(input.deviceId) ?? new Set();
        connections.delete(input.deviceId);
        for (const connection of held) connection.close();
      },
    };
  }),
);
