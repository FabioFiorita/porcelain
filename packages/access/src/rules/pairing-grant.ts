import type { StoredPairingGrant } from '../models/pairing-grant.ts';

export function pairingGrantExpiry(
  createdAt: string,
  lifetimeMs: number,
): string {
  return new Date(Date.parse(createdAt) + lifetimeMs).toISOString();
}

export function pairingGrantRevocable(grant: StoredPairingGrant): boolean {
  return grant.redeemedAt === undefined && grant.revokedAt === undefined;
}

export function pairingGrantPending(
  grant: StoredPairingGrant,
  now: string,
): boolean {
  return pairingGrantRevocable(grant) && grant.expiresAt > now;
}

export function pairingGrantRedeemable(
  grant: StoredPairingGrant,
  now: string,
): boolean {
  return pairingGrantPending(grant, now) && grant.createdAt <= now;
}
