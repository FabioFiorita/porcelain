import type { RemoteRoutes } from '../../src/models/remote-access.ts';
import type { RouteStateStore } from '../../src/ports/route-state-store.ts';

export class InMemoryRouteStateStore implements RouteStateStore {
  private routes: RemoteRoutes = {
    states: {
      lan: { kind: 'off' },
      tailnet: { kind: 'off' },
      cloudflare: { kind: 'off' },
    },
    origins: [],
  };

  read(): RemoteRoutes {
    return this.routes;
  }

  save(input: RemoteRoutes): void {
    this.routes = input;
  }
}
