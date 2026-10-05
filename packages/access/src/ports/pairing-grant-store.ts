import type { Effect } from 'effect';
import { Context } from 'effect';
import type {
  NewPairingGrants,
  PairingGrantKey,
  PairingGrantRevocation,
  PairingRedemption,
  StoredPairingGrant,
} from '../models/pairing-grant.ts';

export interface PairingGrantStore {
  add(input: NewPairingGrants): Effect.Effect<void>;
  find(input: PairingGrantKey): Effect.Effect<StoredPairingGrant | undefined>;
  list(): Effect.Effect<StoredPairingGrant[]>;
  markRevoked(input: PairingGrantRevocation): Effect.Effect<void>;
  redeem(input: PairingRedemption): Effect.Effect<void>;
}

export const PairingGrantStore = Context.Service<
  '@porcelain/access/PairingGrantStore',
  PairingGrantStore
>('@porcelain/access/PairingGrantStore');
