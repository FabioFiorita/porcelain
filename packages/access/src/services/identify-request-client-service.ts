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

  execute(input: IdentifyRequestClientInput): RequestClient {
    return requestClient(
      input,
      answeredTunnelHosts(
        this.remoteAccess.read(),
        this.routeStates.read().states,
      ),
    );
  }
}
