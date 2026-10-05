import { Effect } from 'effect';
import type {
  NetworkAddress,
  OpenRemoteRoutesInput,
  RemoteAccessSettings,
  RemoteRouteOptions,
  RouteState,
  RouteStates,
  TailnetProxy,
} from '../models/remote-access.ts';
import type { NetworkAddressReader } from '../ports/network-address-reader.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteListenerRunner } from '../ports/route-listener-runner.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { TunnelProbe } from '../ports/tunnel-probe.ts';
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

export class OpenRemoteRoutesService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly networkAddresses: NetworkAddressReader;
  private readonly routeListeners: RouteListenerRunner;
  private readonly tunnelProbe: TunnelProbe;
  private readonly options: RemoteRouteOptions;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    networkAddresses: NetworkAddressReader,
    routeListeners: RouteListenerRunner,
    tunnelProbe: TunnelProbe,
    options: RemoteRouteOptions,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.networkAddresses = networkAddresses;
    this.routeListeners = routeListeners;
    this.tunnelProbe = tunnelProbe;
    this.options = options;
  }

  execute(input: OpenRemoteRoutesInput): Effect.Effect<void, never> {
    return Effect.gen({ self: this }, function* () {
      const saved = this.remoteAccess.read();
      const settings = input.closing
        ? { ...saved, lan: false, tailnet: false, cloudflare: false }
        : saved;
      const current = this.routeStates.read().states;
      const lan = yield* this.lan(settings, this.networkAddresses.list());
      const tailnet = yield* this.tailnet(settings, current.tailnet);
      const opened = { ...current, lan, tailnet: tailnet.state };
      this.save(opened, tailnet.proxy);
      this.save(
        {
          ...opened,
          tailnet: yield* this.checked(tailnet, input.environmentId),
          cloudflare: yield* this.tunnel(
            settings,
            opened.cloudflare,
            input.environmentId,
          ),
        },
        tailnet.proxy,
      );
    });
  }

  private lan(
    settings: RemoteAccessSettings,
    found: NetworkAddress[],
  ): Effect.Effect<RouteState, never> {
    return Effect.gen({ self: this }, function* () {
      const here = localNetwork(
        found,
        yield* this.networkAddresses.defaultRoutes(),
      );
      if (!settings.lan || !sameNetwork(here, settings.lanNetwork)) {
        yield* this.routeListeners.close({ route: 'lan' });
        return settings.lan ? { kind: 'paused' } : { kind: 'off' };
      }
      return listenedState(
        yield* this.routeListeners.listen({
          route: 'lan',
          addresses: here ? [here.address] : [],
          port: 'server',
        }),
      );
    });
  }

  private tailnet(
    settings: RemoteAccessSettings,
    current: RouteState,
  ): Effect.Effect<TailnetOpening, never> {
    return Effect.gen({ self: this }, function* () {
      const hostname = settings.tailnetHostname;
      if (!settings.tailnet || hostname === undefined) {
        yield* this.routeListeners.close({ route: 'tailnet' });
        return { state: { kind: 'off' } };
      }
      const outcome = yield* this.routeListeners.listen({
        route: 'tailnet',
        addresses: [this.options.loopbackAddress],
        port: settings.tailnetPort ?? 'own',
      });
      if (outcome.bound.length === 0) {
        yield* this.routeListeners.close({ route: 'tailnet' });
        return { state: listenedState(outcome) };
      }
      if (settings.tailnetPort === undefined)
        this.remoteAccess.save({
          ...this.remoteAccess.read(),
          tailnetPort: outcome.port,
        });
      return {
        state: tailnetShownWhileChecking(current),
        check: tailnetNeedsCheck(current),
        proxy: {
          address: this.options.loopbackAddress,
          port: outcome.port,
          hostname,
        },
      };
    });
  }

  private checked(
    tailnet: TailnetOpening,
    environmentId: string,
  ): Effect.Effect<RouteState, never> {
    return Effect.gen({ self: this }, function* () {
      if (tailnet.proxy === undefined || !tailnet.check) return tailnet.state;
      return yield* this.answerAt(tailnet.proxy.hostname, environmentId);
    });
  }

  private tunnel(
    settings: RemoteAccessSettings,
    current: RouteState,
    environmentId: string,
  ): Effect.Effect<RouteState, never> {
    return Effect.gen({ self: this }, function* () {
      const hostname = settings.cloudflareHostname;
      if (!settings.cloudflare || hostname === undefined)
        return { kind: 'off' };
      if (!tunnelNeedsCheck(current)) return current;
      return yield* this.answerAt(hostname, environmentId);
    });
  }

  private answerAt(
    hostname: string,
    environmentId: string,
  ): Effect.Effect<RouteState, never> {
    return Effect.gen({ self: this }, function* () {
      const origin = tunnelOrigin(hostname);
      const answer = yield* this.tunnelProbe.probe({ origin });
      return tunnelState(answer, environmentId, origin);
    });
  }

  private save(
    states: RouteStates,
    tailnetProxy: TailnetProxy | undefined,
  ): void {
    this.routeStates.save({
      states,
      origins: reachableOrigins(states),
      ...(tailnetProxy === undefined ? {} : { tailnetProxy }),
    });
  }
}
