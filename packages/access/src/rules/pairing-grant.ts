import type { StoredPairingGrant } from '../models/pairing-grant.ts';

export function pairingGrantRevocable(grant: StoredPairingGrant): boolean {
  return grant.redeemedAt === undefined && grant.revokedAt === undefined;
}

export function pairingGrantPending(
  grant: StoredPairingGrant,
  now: string,
): boolean {
  return (
    pairingGrantRevocable(grant) &&
    Date.parse(grant.expiresAt) > Date.parse(now)
  );
}

export function pairingGrantRedeemable(
  grant: StoredPairingGrant,
  now: string,
): boolean {
  return (
    pairingGrantPending(grant, now) &&
    Date.parse(grant.createdAt) <= Date.parse(now)
  );
}
