import { RemoteRouteOptions } from '../ports/remote-route-options.ts';
import { Effect, Context, Layer } from 'effect';
import type {
  NetworkAddress,
  OpenRemoteRoutesInput,
  RemoteAccessSettings,
  RouteState,
  RouteStates,
  TailnetProxy,
} from '../models/remote-access.ts';
import { NetworkAddressReader } from '../ports/network-address-reader.ts';
import { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { RouteListenerRunner } from '../ports/route-listener-runner.ts';
import { RouteStateStore } from '../ports/route-state-store.ts';
import { TunnelProbe } from '../ports/tunnel-probe.ts';
import { localNetwork, sameNetwork } from '../rules/local-network.ts';
import {
  listenedState,
  reachableOrigins,
  tunnelNeedsCheck,
  tunnelOrigin,
  tunnelState,
} from '../rules/remote-access.ts';
import {
  tailnetNeedsCheck,
  tailnetShownWhileChecking,
} from '../rules/tailnet.ts';

type TailnetOpening = {
  state: RouteState;
  proxy?: TailnetProxy | undefined;
  check?: boolean | undefined;
};

export class OpenRemoteRoutesService extends Context.Service<
  OpenRemoteRoutesService,
  {
    readonly execute: (
      input: OpenRemoteRoutesInput,
    ) => Effect.Effect<void, never>;
  }
>()('@porcelain/access/OpenRemoteRoutesService') {
  static readonly layer = Layer.effect(
    OpenRemoteRoutesService,
    Effect.gen(function* () {
      const remoteAccess = yield* RemoteAccessStore;
      const routeStates = yield* RouteStateStore;
      const networkAddresses = yield* NetworkAddressReader;
      const routeListeners = yield* RouteListenerRunner;
      const tunnelProbe = yield* TunnelProbe;
      const options = yield* RemoteRouteOptions;
      const operationLan = Effect.fn('OpenRemoteRoutesService.operationLan')(
        function* (
          settings: RemoteAccessSettings,
          found: NetworkAddress[],
        ): Effect.fn.Return<RouteState, never> {
          const here = localNetwork(
            found,
            yield* networkAddresses.defaultRoutes(),
          );
          if (!settings.lan || !sameNetwork(here, settings.lanNetwork)) {
            yield* routeListeners.close({ route: 'lan' });
            return settings.lan ? { kind: 'paused' } : { kind: 'off' };
          }
          return listenedState(
            yield* routeListeners.listen({
              route: 'lan',
              addresses: here ? [here.address] : [],
              port: 'server',
            }),
          );
        },
      );
      const operationTailnet = Effect.fn(
        'OpenRemoteRoutesService.operationTailnet',
      )(function* (
        settings: RemoteAccessSettings,
        current: RouteState,
      ): Effect.fn.Return<TailnetOpening, never> {
        const hostname = settings.tailnetHostname;
        if (!settings.tailnet || hostname === undefined) {
          yield* routeListeners.close({ route: 'tailnet' });
          return { state: { kind: 'off' } };
        }
        const outcome = yield* routeListeners.listen({
          route: 'tailnet',
          addresses: [options.loopbackAddress],
          port: settings.tailnetPort ?? 'own',
        });
        if (outcome.bound.length === 0) {
          yield* routeListeners.close({ route: 'tailnet' });
          return { state: listenedState(outcome) };
        }
        if (settings.tailnetPort === undefined)
          remoteAccess.save({
            ...remoteAccess.read(),
            tailnetPort: outcome.port,
          });
        return {
          state: tailnetShownWhileChecking(current),
          check: tailnetNeedsCheck(current),
          proxy: {
            address: options.loopbackAddress,
            port: outcome.port,
            hostname,
          },
        };
      });
      const operationChecked = Effect.fn(
        'OpenRemoteRoutesService.operationChecked',
      )(function* (
        tailnet: TailnetOpening,
        environmentId: string,
      ): Effect.fn.Return<RouteState, never> {
        if (tailnet.proxy === undefined || !tailnet.check) return tailnet.state;
        return yield* operationAnswerAt(tailnet.proxy.hostname, environmentId);
      });
      const operationTunnel = Effect.fn(
        'OpenRemoteRoutesService.operationTunnel',
      )(function* (
        settings: RemoteAccessSettings,
        current: RouteState,
        environmentId: string,
      ): Effect.fn.Return<RouteState, never> {
        const hostname = settings.cloudflareHostname;
        if (!settings.cloudflare || hostname === undefined)
          return { kind: 'off' };
        if (!tunnelNeedsCheck(current)) return current;
        return yield* operationAnswerAt(hostname, environmentId);
      });
      const operationAnswerAt = Effect.fn(
        'OpenRemoteRoutesService.operationAnswerAt',
      )(function* (
        hostname: string,
        environmentId: string,
      ): Effect.fn.Return<RouteState, never> {
        const origin = tunnelOrigin(hostname);
        const answer = yield* tunnelProbe.probe({ origin });
        return tunnelState(answer, environmentId, origin);
      });
      function operationSave(
        states: RouteStates,
        tailnetProxy: TailnetProxy | undefined,
      ): void {
        routeStates.save({
          states,
          origins: reachableOrigins(states),
          ...(tailnetProxy === undefined ? {} : { tailnetProxy }),
        });
      }
      return {
        execute: Effect.fn('OpenRemoteRoutesService.execute')(function* (
          input: OpenRemoteRoutesInput,
        ): Effect.fn.Return<void, never> {
          const saved = remoteAccess.read();
          const settings = input.closing
            ? { ...saved, lan: false, tailnet: false, cloudflare: false }
            : saved;
          const current = routeStates.read().states;
          const lan = yield* operationLan(settings, networkAddresses.list());
          const tailnet = yield* operationTailnet(settings, current.tailnet);
          const opened = { ...current, lan, tailnet: tailnet.state };
          operationSave(opened, tailnet.proxy);
          operationSave(
            {
              ...opened,
              tailnet: yield* operationChecked(tailnet, input.environmentId),
              cloudflare: yield* operationTunnel(
                settings,
                opened.cloudflare,
                input.environmentId,
              ),
            },
            tailnet.proxy,
          );
        }),
      };
    }),
  );
}
