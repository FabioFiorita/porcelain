import type { PairingGrant } from './pairing-grant.ts';

export type IssuePairingInput = {
  labels: readonly string[];
  addresses: readonly string[];
  environmentId: string;
  trusted?: boolean | undefined;
};

type PairingLink = {
  addresses: string[];
  code: string;
  environmentId: string;
};

export type IssuedPairingGrant = {
  grant: PairingGrant & { trusted: boolean };
  code: string;
  link: PairingLink;
};

export type IssuePairingResult = { grants: IssuedPairingGrant[] };

export type IssuePairingOptions = { lifetimeMs: number; labelLength: number };
