import type {
  NewPairingGrants,
  PairingGrantKey,
  PairingGrantRevocation,
  PairingRedemption,
  StoredPairingGrant,
} from '../models/pairing-grant.ts';

export interface PairingGrantStore {
  add(input: NewPairingGrants): void;
  find(input: PairingGrantKey): StoredPairingGrant | undefined;
  list(): StoredPairingGrant[];
  markRevoked(input: PairingGrantRevocation): void;
  redeem(input: PairingRedemption): void;
}
