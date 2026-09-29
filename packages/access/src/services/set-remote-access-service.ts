import { InvalidTunnelHostnameError } from '../errors/invalid-tunnel-hostname-error.ts';
import { MissingTunnelHostnameError } from '../errors/missing-tunnel-hostname-error.ts';
import type {
  RemoteAccess,
  RemoteAccessChange,
  RemoteAccessOptions,
  RemoteAccessProblem,
} from '../models/remote-access.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import type { RuntimeStatusReader } from '../ports/runtime-status-reader.ts';
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
  private readonly options: RemoteAccessOptions;

  constructor(
    remoteAccess: RemoteAccessStore,
    routeStates: RouteStateStore,
    runtimeStatusReader: RuntimeStatusReader,
    options: RemoteAccessOptions,
  ) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
    this.runtimeStatusReader = runtimeStatusReader;
    this.options = options;
  }

  execute(input: RemoteAccessChange): RemoteAccess {
    const decision = changedRemoteAccess(
      this.remoteAccess.read(),
      input,
      this.options.hostnameLength,
    );
    if (decision.kind !== 'settings') throw this.failure(decision);
    this.remoteAccess.save(decision.settings);
    const states = requestedStates(
      this.routeStates.read().states,
      input,
      decision.settings,
    );
    this.routeStates.save({ states, origins: reachableOrigins(states) });
    return remoteAccessView(
      decision.settings,
      states,
      this.runtimeStatusReader.current().address,
    );
  }

  private failure(problem: RemoteAccessProblem): Error {
    switch (problem.kind) {
      case 'invalid-hostname':
        return new InvalidTunnelHostnameError();
      case 'missing-hostname':
        return new MissingTunnelHostnameError();
    }
  }
}
