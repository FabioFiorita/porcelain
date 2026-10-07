import { Effect, Layer } from 'effect';
import type { TunnelHostnames } from '@porcelain/access/models';
import type {
  HeldConnection,
  ReleaseConnection,
} from '../../ports/device-connection-store.ts';
import {
  type TunnelConnection,
  TunnelConnectionStore,
} from '../../ports/tunnel-connection-store.ts';

export const inMemoryTunnelConnectionStoreLayer = Layer.effect(
  TunnelConnectionStore,
  Effect.sync(() => {
    const connections = new Map<HeldConnection, string>();
    return {
      insert(input: TunnelConnection): ReleaseConnection {
        connections.set(input.connection, input.hostname);
        return () => {
          connections.delete(input.connection);
        };
      },
      retain(input: TunnelHostnames): void {
        for (const [connection, hostname] of [...connections])
          if (!input.hostnames.includes(hostname)) {
            connections.delete(connection);
            connection.close();
          }
      },
    };
  }),
);
