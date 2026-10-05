import { RemoteAccessOptions } from '../ports/remote-access-options.ts';
import { Effect, Context, Layer } from 'effect';
import { InvalidTailnetHostnameError } from '../errors/invalid-tailnet-hostname-error.ts';
import { InvalidTunnelHostnameError } from '../errors/invalid-tunnel-hostname-error.ts';
import { MissingTailnetHostnameError } from '../errors/missing-tailnet-hostname-error.ts';
import { MissingTunnelHostnameError } from '../errors/missing-tunnel-hostname-error.ts';
import { NoLocalNetworkError } from '../errors/no-local-network-error.ts';
import { UnidentifiedLocalNetworkError } from '../errors/unidentified-local-network-error.ts';
import type {
  RemoteAccess,
  RemoteAccessChange,
  RemoteAccessProblem,
} from '../models/remote-access.ts';
import { NetworkAddressReader } from '../ports/network-address-reader.ts';
import { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { RouteStateStore } from '../ports/route-state-store.ts';
import { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
import { localNetwork } from '../rules/local-network.ts';
import {
  changedRemoteAccess,
  reachableOrigins,
  remoteAccessView,
  requestedStates,
} from '../rules/remote-access.ts';

export class SetRemoteAccessService extends Context.Service<
  SetRemoteAccessService,
  {
    readonly execute: (
      input: RemoteAccessChange,
    ) => Effect.Effect<
      RemoteAccess,
      | InvalidTunnelHostnameError
      | MissingTunnelHostnameError
      | InvalidTailnetHostnameError
      | MissingTailnetHostnameError
      | NoLocalNetworkError
      | UnidentifiedLocalNetworkError
    >;
  }
>()('@porcelain/access/SetRemoteAccessService') {
  static readonly layer = Layer.effect(
    SetRemoteAccessService,
    Effect.gen(function* () {
      const remoteAccess = yield* RemoteAccessStore;
      const routeStates = yield* RouteStateStore;
      const runtimeStatusReader = yield* RuntimeStatusReader;
      const networkAddresses = yield* NetworkAddressReader;
      const options = yield* RemoteAccessOptions;
      function operationFailure(
        problem: RemoteAccessProblem,
      ):
        | InvalidTunnelHostnameError
        | MissingTunnelHostnameError
        | InvalidTailnetHostnameError
        | MissingTailnetHostnameError
        | NoLocalNetworkError
        | UnidentifiedLocalNetworkError {
        switch (problem.kind) {
          case 'invalid-hostname':
            return new InvalidTunnelHostnameError();
          case 'missing-hostname':
            return new MissingTunnelHostnameError();
          case 'invalid-tailnet-hostname':
            return new InvalidTailnetHostnameError();
          case 'missing-tailnet-hostname':
            return new MissingTailnetHostnameError();
          case 'no-local-network':
            return new NoLocalNetworkError();
          case 'unidentified-local-network':
            return new UnidentifiedLocalNetworkError();
        }
      }
      return {
        execute: Effect.fn('SetRemoteAccessService.execute')(function* (
          input: RemoteAccessChange,
        ): Effect.fn.Return<
          RemoteAccess,
          | InvalidTunnelHostnameError
          | MissingTunnelHostnameError
          | InvalidTailnetHostnameError
          | MissingTailnetHostnameError
          | NoLocalNetworkError
          | UnidentifiedLocalNetworkError
        > {
          const here = localNetwork(
            networkAddresses.list(),
            yield* Effect.interruptible(networkAddresses.defaultRoutes()),
          );
          const decision = changedRemoteAccess(
            yield* remoteAccess.read(),
            input,
            options.hostnameLength,
            here,
          );
          if (decision.kind !== 'settings')
            return yield* Effect.fail(operationFailure(decision));
          yield* remoteAccess.save(decision.settings);
          const current = routeStates.read();
          const states = requestedStates(
            current.states,
            input,
            decision.settings,
          );
          const routes = {
            ...current,
            states,
            origins: reachableOrigins(states),
          };
          routeStates.save(routes);
          return remoteAccessView(
            decision.settings,
            routes,
            runtimeStatusReader.current().address,
            here,
          );
        }),
      };
    }),
  );
}
