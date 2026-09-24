import type { PairingGrant } from './pairing-grant.ts';

export type IssuePairingInput = {
  labels: readonly string[];
  addresses: readonly string[];
  environmentId: string;
};

export type IssuedPairingGrant = {
  grant: PairingGrant;
  code: string;
  link: string;
};

export type IssuePairingResult = { grants: IssuedPairingGrant[] };

export type IssuePairingOptions = { lifetimeMs: number };
