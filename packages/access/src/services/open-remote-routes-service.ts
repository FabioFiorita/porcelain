import type {
  ListenedRoute,
  OpenRemoteRoutesInput,
  RemoteAccessSettings,
  RouteState,
  RouteStates,
} from '../models/remote-access.ts';
import type { NetworkAddressReader } from '../ports/network-address-reader.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteListenerRunner } from '../ports/route-listener-runner.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { TunnelProbe } from '../ports/tunnel-probe.ts';
import {
  lanAddresses,
  listenedState,
  reachableOrigins,
  tailnetAddresses,
  tunnelNeedsCheck,
  tunnelOrigin,
  tunnelState,
} from '../rules/remote-access.ts';

export class OpenRemoteRoutesService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly networkAddresses: NetworkAddressReader;
  private readonly routeListeners: RouteListenerRunner;
  private readonly tunnelProbe: TunnelProbe;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    networkAddresses: NetworkAddressReader,
    routeListeners: RouteListenerRunner,
    tunnelProbe: TunnelProbe,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.networkAddresses = networkAddresses;
    this.routeListeners = routeListeners;
    this.tunnelProbe = tunnelProbe;
  }

  async execute(
    input: OpenRemoteRoutesInput,
    signal?: AbortSignal,
  ): Promise<void> {
    const settings = this.remoteAccess.read();
    const found = this.networkAddresses.list();
    const lan = await this.listen(
      'lan',
      settings.lan,
      lanAddresses(found),
      signal,
    );
    const tailnet = await this.listen(
      'tailnet',
      settings.tailnet,
      tailnetAddresses(found),
      signal,
    );
    const opened = { ...this.routeStates.read().states, lan, tailnet };
    this.save(opened);
    this.save({
      ...opened,
      cloudflare: await this.tunnel(
        settings,
        opened.cloudflare,
        input.environmentId,
        signal,
      ),
    });
  }

  private async listen(
    route: ListenedRoute,
    enabled: boolean,
    addresses: string[],
    signal: AbortSignal | undefined,
  ): Promise<RouteState> {
    if (!enabled) {
      await this.routeListeners.close({ route });
      return { kind: 'off' };
    }
    const outcome = await this.routeListeners.listen(
      { route, addresses },
      signal,
    );
    return listenedState(addresses, outcome);
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
    const origin = tunnelOrigin(hostname);
    const answer = await this.tunnelProbe.probe({ origin }, signal);
    return tunnelState(answer, environmentId, origin);
  }

  private save(states: RouteStates): void {
    this.routeStates.save({ states, origins: reachableOrigins(states) });
  }
}
