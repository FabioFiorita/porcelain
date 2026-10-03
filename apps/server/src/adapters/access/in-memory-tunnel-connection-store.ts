import type { TunnelHostnames } from '@porcelain/access/models';
import type {
  HeldConnection,
  ReleaseConnection,
} from '../../ports/device-connection-store.ts';
import type {
  TunnelConnection,
  TunnelConnectionStore,
} from '../../ports/tunnel-connection-store.ts';

export class InMemoryTunnelConnectionStore implements TunnelConnectionStore {
  private readonly connections = new Map<HeldConnection, string>();

  insert(input: TunnelConnection): ReleaseConnection {
    this.connections.set(input.connection, input.hostname);
    return () => {
      this.connections.delete(input.connection);
    };
  }

  retain(input: TunnelHostnames): void {
    for (const [connection, hostname] of [...this.connections])
      if (!input.hostnames.includes(hostname)) {
        this.connections.delete(connection);
        connection.close();
      }
  }
}
