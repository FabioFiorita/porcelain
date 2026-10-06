import type { PairingGrant } from './pairing-grant.ts';
import type { Redacted } from 'effect';

export type IssuePairingInput = {
  labels: readonly string[];
  addresses: readonly string[];
  environmentId: string;
  trusted?: boolean | undefined;
};

type PairingLink = {
  addresses: string[];
  code: Redacted.Redacted<string>;
  environmentId: string;
};

export type IssuedPairingGrant = {
  grant: PairingGrant & { trusted: boolean };
  code: Redacted.Redacted<string>;
  link: PairingLink;
};

export type IssuePairingResult = { grants: IssuedPairingGrant[] };

export type IssuePairingOptions = { lifetimeMs: number; labelLength: number };
