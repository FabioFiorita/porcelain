import { Effect, Layer } from 'effect';
import type { RemoteRoutes } from '@porcelain/access/models';
import { RouteStateStore } from '@porcelain/access/ports';

export const inMemoryRouteStateStoreLayer = Layer.effect(
  RouteStateStore,
  Effect.sync(() => {
    let routes: RemoteRoutes = {
      states: {
        lan: { kind: 'off' },
        tailnet: { kind: 'off' },
        cloudflare: { kind: 'off' },
      },
      origins: [],
    };
    return {
      read(): RemoteRoutes {
        return routes;
      },
      save(input: RemoteRoutes): void {
        routes = input;
      },
    };
  }),
);
