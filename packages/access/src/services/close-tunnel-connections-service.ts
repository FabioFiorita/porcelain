import { Effect } from 'effect';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { TunnelConnectionStore } from '../ports/tunnel-connection-store.ts';
import { answeredTunnelHosts } from '../rules/remote-access.ts';

export class CloseTunnelConnectionsService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly tunnelConnections: TunnelConnectionStore;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    tunnelConnections: TunnelConnectionStore,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.tunnelConnections = tunnelConnections;
  }

  execute(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.tunnelConnections.retain({
        hostnames: answeredTunnelHosts(
          this.remoteAccess.read(),
          this.routeStates.read().states,
        ),
      });
    });
  }
}
