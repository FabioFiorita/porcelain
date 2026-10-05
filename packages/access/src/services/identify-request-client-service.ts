import { Effect } from 'effect';
import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '../models/identify-request-client.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import { answeredTunnelHosts } from '../rules/remote-access.ts';
import { requestClient } from '../rules/request-client.ts';

export class IdentifyRequestClientService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;

  constructor(remoteAccess: RemoteAccessStore, routeStates: RouteStateStore) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
  }

  execute(
    input: IdentifyRequestClientInput,
  ): Effect.Effect<RequestClient, never> {
    return Effect.sync(() => {
      const routes = this.routeStates.read();
      return requestClient(
        input,
        answeredTunnelHosts(this.remoteAccess.read(), routes.states),
        routes.tailnetProxy,
      );
    });
  }
}
