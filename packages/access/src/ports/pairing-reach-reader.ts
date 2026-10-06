import { Context } from 'effect';
import type { PairingReach } from '../models/pairing-reach.ts';

export interface PairingReachReader {
  current(): PairingReach;
}

export const PairingReachReader = Context.Service<
  '@porcelain/access/PairingReachReader',
  PairingReachReader
>('@porcelain/access/PairingReachReader');
