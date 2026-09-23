import type { PairingGrant } from './pairing-grant.ts';

export type IssuePairingInput = {
  labels: readonly string[];
  addresses: readonly string[];
};

export type IssuedPairingGrant = { grant: PairingGrant; code: string };

export type IssuePairingResult = { grants: IssuedPairingGrant[] };
