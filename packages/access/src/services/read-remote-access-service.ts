import type { RemoteAccess } from '../models/remote-access.ts';
import type { NetworkAddressReader } from '../ports/network-address-reader.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
import { defaultRoutes, localNetwork } from '../rules/local-network.ts';
import { remoteAccessView } from '../rules/remote-access.ts';

export class ReadRemoteAccessService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly runtimeStatusReader: RuntimeStatusReader;
  private readonly networkAddresses: NetworkAddressReader;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    runtimeStatusReader: RuntimeStatusReader,
    networkAddresses: NetworkAddressReader,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.runtimeStatusReader = runtimeStatusReader;
    this.networkAddresses = networkAddresses;
  }

  execute(): RemoteAccess {
    return remoteAccessView(
      this.remoteAccess.read(),
      this.routeStates.read().states,
      this.runtimeStatusReader.current().address,
      localNetwork(
        this.networkAddresses.list(),
        defaultRoutes(this.networkAddresses.routeTable()),
        this.networkAddresses.neighbourTable(),
      ),
    );
  }
}
