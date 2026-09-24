import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type { StoredPairingGrant } from '@porcelain/access/models';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { RevokePairingGrantService } from './revoke-pairing-grant-service.ts';

function setup(grant: Partial<StoredPairingGrant> = {}) {
  const grants = new InMemoryPairingGrantStore();
  grants.add({
    grants: [
      {
        id: 'grant',
        label: 'Phone',
        addresses: ['http://192.168.1.20:4173'],
        createdAt: '2026-09-23T10:00:00.000Z',
        expiresAt: '2026-09-23T10:15:00.000Z',
        secretHash: 'hash',
        ...grant,
      },
    ],
  });
  const clock = new FixedClock('2026-09-23T10:05:00.000Z');
  return {
    grants,
    clock,
    service: new RevokePairingGrantService(grants, clock),
  };
}

describe('RevokePairingGrantService', () => {
  it('revokes an unredeemed grant at the current time', () => {
    const { grants, service } = setup();
    expect(service.execute({ id: 'grant' })).toEqual({ kind: 'revoked' });
    expect(grants.find({ grantId: 'grant' })?.revokedAt).toBe(
      '2026-09-23T10:05:00.000Z',
    );
  });

  it('keeps the first revocation time when the grant is revoked again', () => {
    const { grants, clock, service } = setup();
    service.execute({ id: 'grant' });
    clock.advance(60_000);
    expect(service.execute({ id: 'grant' })).toEqual({ kind: 'not-revoked' });
    expect(grants.find({ grantId: 'grant' })?.revokedAt).toBe(
      '2026-09-23T10:05:00.000Z',
    );
  });

  it('revokes a grant that has already expired', () => {
    const { service } = setup({ expiresAt: '2026-09-23T10:01:00.000Z' });
    expect(service.execute({ id: 'grant' })).toEqual({ kind: 'revoked' });
  });

  it('leaves a redeemed grant alone', () => {
    const { grants, service } = setup({
      redeemedAt: '2026-09-23T10:02:00.000Z',
    });
    expect(service.execute({ id: 'grant' })).toEqual({ kind: 'not-revoked' });
    expect(grants.find({ grantId: 'grant' })?.revokedAt).toBeUndefined();
  });

  it('reports an unknown id as not revoked', () => {
    expect(setup().service.execute({ id: 'unknown' })).toEqual({
      kind: 'not-revoked',
    });
  });
});
