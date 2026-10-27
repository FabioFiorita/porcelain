import { RemoteAccessOptions } from '../ports/remote-access-options.ts';
import { Effect, Context, Layer } from 'effect';
import { InvalidTailnetHostnameError } from '../errors/invalid-tailnet-hostname-error.ts';
import { InvalidTunnelHostnameError } from '../errors/invalid-tunnel-hostname-error.ts';
import { MissingTailnetHostnameError } from '../errors/missing-tailnet-hostname-error.ts';
import { MissingTunnelHostnameError } from '../errors/missing-tunnel-hostname-error.ts';
import { NoLocalNetworkError } from '../errors/no-local-network-error.ts';
import { UnidentifiedLocalNetworkError } from '../errors/unidentified-local-network-error.ts';
import { RemoteRouteInUseError } from '../errors/remote-route-in-use-error.ts';
import { WaysInChangedError } from '../errors/ways-in-changed-error.ts';
import type { WaysInPermissionRequiredError } from '../errors/ways-in-permission-required-error.ts';
import type { RemoteAccessProblem } from '../models/remote-access.ts';
import type { WaysInEdit, WaysInSaved } from '../models/ways-in.ts';
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
import {
  changesRoute,
  protectedRoute,
  waysInFingerprint,
  waysInUnchanged,
} from '../rules/ways-in.ts';
import { AuthorizeWaysInService } from './authorize-ways-in-service.ts';

export class SetRemoteAccessService extends Context.Service<
  SetRemoteAccessService,
  {
    readonly execute: (
      input: WaysInEdit,
    ) => Effect.Effect<
      WaysInSaved,
      | WaysInPermissionRequiredError
      | RemoteRouteInUseError
      | WaysInChangedError
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
      const authorizeWaysIn = yield* AuthorizeWaysInService;
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
          input: WaysInEdit,
        ): Effect.fn.Return<
          WaysInSaved,
          | WaysInPermissionRequiredError
          | RemoteRouteInUseError
          | WaysInChangedError
          | InvalidTunnelHostnameError
          | MissingTunnelHostnameError
          | InvalidTailnetHostnameError
          | MissingTailnetHostnameError
          | NoLocalNetworkError
          | UnidentifiedLocalNetworkError
        > {
          if (changesRoute(input.change, protectedRoute(input.caller)))
            return yield* Effect.fail(new RemoteRouteInUseError());
          const here = localNetwork(
            networkAddresses.list(),
            yield* Effect.interruptible(networkAddresses.defaultRoutes()),
          );
          const settings = yield* remoteAccess.read();
          const decision = changedRemoteAccess(
            settings,
            input.change,
            options.hostnameLength,
            here,
          );
          const fingerprint = waysInFingerprint(settings, here);
          if (decision.kind !== 'settings')
            return yield* Effect.fail(
              fingerprint === input.expected
                ? operationFailure(decision)
                : new WaysInChangedError(),
            );
          yield* authorizeWaysIn.execute(input.caller);
          const current = routeStates.read();
          const states = requestedStates(
            current.states,
            input.change,
            decision.settings,
          );
          if (
            waysInUnchanged(
              { settings, states: current.states },
              { settings: decision.settings, states },
              here,
            )
          )
            return {
              remote: remoteAccessView(
                settings,
                current,
                runtimeStatusReader.current().address,
                here,
              ),
              fingerprint,
              applied: false,
            };
          if (fingerprint !== input.expected)
            return yield* Effect.fail(new WaysInChangedError());
          yield* remoteAccess.save(decision.settings);
          const routes = {
            ...current,
            states,
            origins: reachableOrigins(states),
          };
          routeStates.save(routes);
          return {
            remote: remoteAccessView(
              decision.settings,
              routes,
              runtimeStatusReader.current().address,
              here,
            ),
            fingerprint: waysInFingerprint(decision.settings, here),
            applied: true,
          };
        }),
      };
    }),
  );
}
