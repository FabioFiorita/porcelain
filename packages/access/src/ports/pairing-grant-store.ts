import type {
  PairingRedemption,
  StoredPairingGrant,
} from '../models/pairing-grant.ts';

export interface PairingGrantStore {
  add(grants: readonly StoredPairingGrant[]): void;
  find(grantId: string): StoredPairingGrant | undefined;
  list(): StoredPairingGrant[];
  markRevoked(grantId: string, revokedAt: string): void;
  redeem(redemption: PairingRedemption): void;
}
