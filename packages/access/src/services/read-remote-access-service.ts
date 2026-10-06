import { Effect, Context, Layer } from 'effect';
import type { RemoteAccess } from '../models/remote-access.ts';
import { NetworkAddressReader } from '../ports/network-address-reader.ts';
import { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { RouteStateStore } from '../ports/route-state-store.ts';
import { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
import { localNetwork } from '../rules/local-network.ts';
import { remoteAccessView } from '../rules/remote-access.ts';

export class ReadRemoteAccessService extends Context.Service<
  ReadRemoteAccessService,
  { readonly execute: () => Effect.Effect<RemoteAccess, never> }
>()('@porcelain/access/ReadRemoteAccessService') {
  static readonly layer = Layer.effect(
    ReadRemoteAccessService,
    Effect.gen(function* () {
      const remoteAccess = yield* RemoteAccessStore;
      const routeStates = yield* RouteStateStore;
      const runtimeStatusReader = yield* RuntimeStatusReader;
      const networkAddresses = yield* NetworkAddressReader;

      return {
        execute: Effect.fn('ReadRemoteAccessService.execute')(
          function* (): Effect.fn.Return<RemoteAccess, never> {
            const here = localNetwork(
              networkAddresses.list(),
              yield* networkAddresses.defaultRoutes(),
            );
            return remoteAccessView(
              yield* remoteAccess.read(),
              routeStates.read(),
              runtimeStatusReader.current().address,
              here,
            );
          },
        ),
      };
    }),
  );
}
