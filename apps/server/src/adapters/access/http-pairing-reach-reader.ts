import type { PairingReach } from '@porcelain/access/models';
import type {
  PairingReachReader,
  RouteStateStore,
} from '@porcelain/access/ports';

export class HttpPairingReachReader implements PairingReachReader {
  private readonly reach: () => PairingReach;
  private readonly routeStates: RouteStateStore;

  constructor(reach: () => PairingReach, routeStates: RouteStateStore) {
    this.reach = reach;
    this.routeStates = routeStates;
  }

  current(): PairingReach {
    return { ...this.reach(), origins: this.routeStates.read().origins };
  }
}
