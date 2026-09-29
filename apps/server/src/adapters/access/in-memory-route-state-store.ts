import type { RemoteRoutes } from '@porcelain/access/models';
import type { RouteStateStore } from '@porcelain/access/ports';

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
