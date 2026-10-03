import type { PairingReach } from '../models/pairing-reach.ts';

export interface PairingReachReader {
  current(): PairingReach;
}
