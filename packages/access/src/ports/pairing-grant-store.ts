import type {
  PairingRedemption,
  StoredPairingGrant,
} from '../models/pairing-grant.ts';

export interface PairingGrantStore {
  add(input: { grants: readonly StoredPairingGrant[] }): void;
  find(input: { grantId: string }): StoredPairingGrant | undefined;
  list(): StoredPairingGrant[];
  markRevoked(input: { grant: StoredPairingGrant; revokedAt: string }): void;
  redeem(input: PairingRedemption): void;
}
