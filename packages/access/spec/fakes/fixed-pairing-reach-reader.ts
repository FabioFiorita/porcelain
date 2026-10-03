import type { PairingReach } from '../../src/models/pairing-reach.ts';
import type { PairingReachReader } from '../../src/ports/pairing-reach-reader.ts';

export class FixedPairingReachReader implements PairingReachReader {
  private readonly reach: PairingReach;

  constructor(reach: PairingReach) {
    this.reach = reach;
  }

  current(): PairingReach {
    return this.reach;
  }
}
