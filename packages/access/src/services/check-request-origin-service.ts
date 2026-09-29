import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import type { RouteStateStore } from '../ports/route-state-store.ts';
import { httpsHosts } from '../rules/remote-access.ts';
import { requestOriginCheck } from '../rules/request-origin-check.ts';

export class CheckRequestOriginService {
  private readonly remoteAccess: RemoteAccessStore;
  private readonly routeStates: RouteStateStore;

  constructor(remoteAccess: RemoteAccessStore, routeStates: RouteStateStore) {
    this.remoteAccess = remoteAccess;
    this.routeStates = routeStates;
  }

  execute(input: CheckRequestOriginInput): CheckRequestOriginResult {
    return requestOriginCheck(
      input,
      httpsHosts(this.remoteAccess.read(), this.routeStates.read()),
    );
  }
}
