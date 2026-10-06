import { Effect, Context, Layer } from 'effect';
import { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { RouteStateStore } from '../ports/route-state-store.ts';
import { TunnelConnectionStore } from '../ports/tunnel-connection-store.ts';
import { answeredTunnelHosts } from '../rules/remote-access.ts';

export class CloseTunnelConnectionsService extends Context.Service<
  CloseTunnelConnectionsService,
  { readonly execute: () => Effect.Effect<void, never> }
>()('@porcelain/access/CloseTunnelConnectionsService') {
  static readonly layer = Layer.effect(
    CloseTunnelConnectionsService,
    Effect.gen(function* () {
      const remoteAccess = yield* RemoteAccessStore;
      const routeStates = yield* RouteStateStore;
      const tunnelConnections = yield* TunnelConnectionStore;

      return {
        execute: Effect.fn('CloseTunnelConnectionsService.execute')(
          function* (): Effect.fn.Return<void, never> {
            tunnelConnections.retain({
              hostnames: answeredTunnelHosts(
                yield* remoteAccess.read(),
                routeStates.read().states,
              ),
            });
          },
        ),
      };
    }),
  );
}
