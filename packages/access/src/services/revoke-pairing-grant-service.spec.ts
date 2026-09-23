import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { RevokePairingGrantService } from './revoke-pairing-grant-service.ts';

function setup(grant: { redeemedAt?: string; expiresAt?: string } = {}) {
  const grants = new InMemoryPairingGrantStore();
  grants.add([
    {
      id: 'grant',
      label: 'Phone',
      addresses: ['http://192.168.1.20:4173'],
      createdAt: '2026-09-23T10:00:00.000Z',
      expiresAt: '2026-09-23T10:15:00.000Z',
      secretHash: 'hash',
      ...grant,
    },
  ]);
  const service = new RevokePairingGrantService(
    grants,
    new FixedClock('2026-09-23T10:05:00.000Z'),
  );
  return { grants, service };
}

describe('RevokePairingGrantService', () => {
  it('revokes an unredeemed grant once', () => {
    const { grants, service } = setup();
    expect(service.execute({ id: 'grant' })).toEqual({
      revoked: true,
      kind: 'grant',
    });
    expect(grants.find('grant')?.revokedAt).toBe('2026-09-23T10:05:00.000Z');
    expect(service.execute({ id: 'grant' })).toEqual({ revoked: false });
  });

  it('revokes a grant that has already expired', () => {
    const { service } = setup({ expiresAt: '2026-09-23T10:01:00.000Z' });
    expect(service.execute({ id: 'grant' })).toEqual({
      revoked: true,
      kind: 'grant',
    });
  });

  it('leaves a redeemed grant and an unknown id alone', () => {
    const { grants, service } = setup({
      redeemedAt: '2026-09-23T10:02:00.000Z',
    });
    expect(service.execute({ id: 'grant' })).toEqual({ revoked: false });
    expect(grants.find('grant')?.revokedAt).toBeUndefined();
    expect(service.execute({ id: 'unknown' })).toEqual({ revoked: false });
  });
});
