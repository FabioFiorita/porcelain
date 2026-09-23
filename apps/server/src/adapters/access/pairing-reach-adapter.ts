import type { PairingReach } from '@porcelain/access/models';
import type { PairingReachReader } from '@porcelain/access/ports';

export class PairingReachAdapter implements PairingReachReader {
  private readonly reach: () => PairingReach;

  constructor(reach: () => PairingReach) {
    this.reach = reach;
  }

  current(): PairingReach {
    return this.reach();
  }
}
