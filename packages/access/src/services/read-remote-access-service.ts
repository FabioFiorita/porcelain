import { Effect } from 'effect';
import type { RemoteAccess } from '../models/remote-access.ts';
import type { NetworkAddressReader } from '../ports/network-address-reader.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
import { localNetwork } from '../rules/local-network.ts';
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

  execute(): Effect.Effect<RemoteAccess, never> {
    return Effect.gen({ self: this }, function* () {
      const here = localNetwork(
        this.networkAddresses.list(),
        yield* this.networkAddresses.defaultRoutes(),
      );
      return remoteAccessView(
        this.remoteAccess.read(),
        this.routeStates.read(),
        this.runtimeStatusReader.current().address,
        here,
      );
    });
  }
}
