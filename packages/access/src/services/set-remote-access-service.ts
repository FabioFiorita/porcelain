import { InvalidTailnetHostnameError } from '../errors/invalid-tailnet-hostname-error.ts';
import { InvalidTunnelHostnameError } from '../errors/invalid-tunnel-hostname-error.ts';
import { MissingTailnetHostnameError } from '../errors/missing-tailnet-hostname-error.ts';
import { MissingTunnelHostnameError } from '../errors/missing-tunnel-hostname-error.ts';
import { NoLocalNetworkError } from '../errors/no-local-network-error.ts';
import { UnidentifiedLocalNetworkError } from '../errors/unidentified-local-network-error.ts';
import type {
  RemoteAccess,
  RemoteAccessChange,
  RemoteAccessOptions,
  RemoteAccessProblem,
} from '../models/remote-access.ts';
import type { NetworkAddressReader } from '../ports/network-address-reader.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
import { defaultRoutes, localNetwork } from '../rules/local-network.ts';
import {
  changedRemoteAccess,
  reachableOrigins,
  remoteAccessView,
  requestedStates,
} from '../rules/remote-access.ts';

export class SetRemoteAccessService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly runtimeStatusReader: RuntimeStatusReader;
  private readonly networkAddresses: NetworkAddressReader;
  private readonly options: RemoteAccessOptions;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    runtimeStatusReader: RuntimeStatusReader,
    networkAddresses: NetworkAddressReader,
    options: RemoteAccessOptions,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.runtimeStatusReader = runtimeStatusReader;
    this.networkAddresses = networkAddresses;
    this.options = options;
  }

  execute(input: RemoteAccessChange): RemoteAccess {
    const here = localNetwork(
      this.networkAddresses.list(),
      defaultRoutes(this.networkAddresses.routeTable()),
      this.networkAddresses.neighbourTable(),
    );
    const decision = changedRemoteAccess(
      this.remoteAccess.read(),
      input,
      this.options.hostnameLength,
      here,
    );
    if (decision.kind !== 'settings') throw this.failure(decision);
    this.remoteAccess.save(decision.settings);
    const current = this.routeStates.read();
    const states = requestedStates(current.states, input, decision.settings);
    const routes = { ...current, states, origins: reachableOrigins(states) };
    this.routeStates.save(routes);
    return remoteAccessView(
      decision.settings,
      routes,
      this.runtimeStatusReader.current().address,
      here,
    );
  }

  private failure(problem: RemoteAccessProblem): Error {
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
}
