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
import {
  defaultRoutes,
  localNetwork,
  sameNetwork,
} from '../rules/local-network.ts';
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

  async execute(
    input: OpenRemoteRoutesInput,
    signal?: AbortSignal,
  ): Promise<void> {
    const saved = this.remoteAccess.read();
    const settings = input.closing
      ? { ...saved, lan: false, tailnet: false, cloudflare: false }
      : saved;
    const current = this.routeStates.read().states;
    const lan = await this.lan(settings, this.networkAddresses.list(), signal);
    const tailnet = await this.tailnet(settings, current.tailnet, signal);
    const opened = { ...current, lan, tailnet: tailnet.state };
    this.save(opened, tailnet.proxy);
    this.save(
      {
        ...opened,
        tailnet: await this.checked(tailnet, input.environmentId, signal),
        cloudflare: await this.tunnel(
          settings,
          opened.cloudflare,
          input.environmentId,
          signal,
        ),
      },
      tailnet.proxy,
    );
  }

  private async lan(
    settings: RemoteAccessSettings,
    found: NetworkAddress[],
    signal: AbortSignal | undefined,
  ): Promise<RouteState> {
    const here = localNetwork(
      found,
      defaultRoutes(this.networkAddresses.routeTable()),
      this.networkAddresses.neighbourTable(),
    );
    if (!settings.lan || !sameNetwork(here, settings.lanNetwork)) {
      await this.routeListeners.close({ route: 'lan' });
      return settings.lan ? { kind: 'paused' } : { kind: 'off' };
    }
    return listenedState(
      await this.routeListeners.listen(
        { route: 'lan', addresses: here ? [here.address] : [], port: 'server' },
        signal,
      ),
    );
  }

  private async tailnet(
    settings: RemoteAccessSettings,
    current: RouteState,
    signal: AbortSignal | undefined,
  ): Promise<TailnetOpening> {
    const hostname = settings.tailnetHostname;
    if (!settings.tailnet || hostname === undefined) {
      await this.routeListeners.close({ route: 'tailnet' });
      return { state: { kind: 'off' } };
    }
    const outcome = await this.routeListeners.listen(
      {
        route: 'tailnet',
        addresses: [this.options.loopbackAddress],
        port: settings.tailnetPort ?? 'own',
      },
      signal,
    );
    if (outcome.bound.length === 0) {
      await this.routeListeners.close({ route: 'tailnet' });
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
  }

  private async checked(
    tailnet: TailnetOpening,
    environmentId: string,
    signal: AbortSignal | undefined,
  ): Promise<RouteState> {
    if (tailnet.proxy === undefined || !tailnet.check) return tailnet.state;
    return this.answerAt(tailnet.proxy.hostname, environmentId, signal);
  }

  private async tunnel(
    settings: RemoteAccessSettings,
    current: RouteState,
    environmentId: string,
    signal: AbortSignal | undefined,
  ): Promise<RouteState> {
    const hostname = settings.cloudflareHostname;
    if (!settings.cloudflare || hostname === undefined) return { kind: 'off' };
    if (!tunnelNeedsCheck(current)) return current;
    return this.answerAt(hostname, environmentId, signal);
  }

  private async answerAt(
    hostname: string,
    environmentId: string,
    signal: AbortSignal | undefined,
  ): Promise<RouteState> {
    const origin = tunnelOrigin(hostname);
    const answer = await this.tunnelProbe.probe({ origin }, signal);
    return tunnelState(answer, environmentId, origin);
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
