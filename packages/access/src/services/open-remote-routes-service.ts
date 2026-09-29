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
import type { TailnetServeRunner } from '../ports/tailnet-serve-runner.ts';
import type { TailnetStatusReader } from '../ports/tailnet-status-reader.ts';
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
  tailnetOrigin,
  tailnetReadiness,
  tailnetServedByUs,
  tailnetServeFailure,
  tailnetServePlan,
  tailnetTarget,
} from '../rules/tailnet.ts';

type TailnetOpening = { state: RouteState; proxy?: TailnetProxy | undefined };

export class OpenRemoteRoutesService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly networkAddresses: NetworkAddressReader;
  private readonly routeListeners: RouteListenerRunner;
  private readonly tailnetStatus: TailnetStatusReader;
  private readonly tailnetServe: TailnetServeRunner;
  private readonly tunnelProbe: TunnelProbe;
  private readonly options: RemoteRouteOptions;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    networkAddresses: NetworkAddressReader,
    routeListeners: RouteListenerRunner,
    tailnetStatus: TailnetStatusReader,
    tailnetServe: TailnetServeRunner,
    tunnelProbe: TunnelProbe,
    options: RemoteRouteOptions,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.networkAddresses = networkAddresses;
    this.routeListeners = routeListeners;
    this.tailnetStatus = tailnetStatus;
    this.tailnetServe = tailnetServe;
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
    const lan = await this.lan(settings, this.networkAddresses.list(), signal);
    const tailnet = await this.tailnet(settings, signal);
    const opened = {
      ...this.routeStates.read().states,
      lan,
      tailnet: tailnet.state,
    };
    this.save(opened, tailnet.proxy);
    this.save(
      {
        ...opened,
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
    signal: AbortSignal | undefined,
  ): Promise<TailnetOpening> {
    if (!settings.tailnet) {
      await this.routeListeners.close({ route: 'tailnet' });
      await this.stopServing(settings, signal);
      return { state: { kind: 'off' } };
    }
    const readiness = tailnetReadiness(await this.tailnetStatus.read());
    if (readiness.kind === 'failed') {
      await this.routeListeners.close({ route: 'tailnet' });
      return { state: readiness };
    }
    const address = this.options.loopbackAddress;
    const listened = await this.routeListeners.listen(
      { route: 'tailnet', addresses: [address], port: 'own' },
      signal,
    );
    if (listened.bound.length === 0) return { state: listenedState(listened) };
    const target = tailnetTarget(address, listened.port);
    const plan = tailnetServePlan(
      readiness.serving,
      target,
      settings.tailnetServeTarget,
    );
    if (plan === 'taken')
      return { state: { kind: 'failed', reason: 'serve-taken' } };
    if (plan === 'serve') {
      const failure = tailnetServeFailure(
        await this.tailnetServe.serve({ target }, signal),
      );
      if (failure !== undefined)
        return { state: { kind: 'failed', reason: failure } };
      this.remoteAccess.save({
        ...this.remoteAccess.read(),
        tailnetServeTarget: target,
      });
    }
    return {
      state: { kind: 'on', urls: [tailnetOrigin(readiness.hostname)] },
      proxy: { hostname: readiness.hostname, address, port: listened.port },
    };
  }

  private async stopServing(
    settings: RemoteAccessSettings,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const previous = settings.tailnetServeTarget;
    if (previous === undefined) return;
    const report = await this.tailnetStatus.read();
    if (report.kind !== 'status') return;
    if (
      tailnetServedByUs(report, previous) &&
      tailnetServeFailure(
        await this.tailnetServe.stop({ target: previous }, signal),
      ) !== undefined
    )
      return;
    const { tailnetServeTarget: _, ...rest } = this.remoteAccess.read();
    this.remoteAccess.save(rest);
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
