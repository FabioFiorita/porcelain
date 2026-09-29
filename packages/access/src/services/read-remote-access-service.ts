import type { RemoteAccess } from '../models/remote-access.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
import { remoteAccessView } from '../rules/remote-access.ts';

export class ReadRemoteAccessService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;
  private readonly runtimeStatusReader: RuntimeStatusReader;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    runtimeStatusReader: RuntimeStatusReader,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.runtimeStatusReader = runtimeStatusReader;
  }

  execute(): RemoteAccess {
    return remoteAccessView(
      this.remoteAccess.read(),
      this.routeStates.read().states,
      this.runtimeStatusReader.current().address,
    );
  }
}
