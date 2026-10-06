import { testClock } from '@porcelain/kernel/test-kit';
import { PairingGrantStore } from '@porcelain/access/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import type { StoredPairingGrant } from '@porcelain/access/models';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { RevokePairingGrantService } from './revoke-pairing-grant-service.ts';

async function setup(grant: Partial<StoredPairingGrant> = {}) {
  const grants = new InMemoryPairingGrantStore();
  await Effect.runPromise(
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
    }),
  );
  const clock = await testClock('2026-09-23T10:05:00.000Z');
  return {
    grants,
    clock,
    service: Effect.runSync(
      RevokePairingGrantService.pipe(
        Effect.provide(RevokePairingGrantService.layer),
        Effect.provideService(PairingGrantStore, grants),
        Effect.provideService(Clock.Clock, clock),
      ),
    ),
  };
}

describe('RevokePairingGrantService', () => {
  it('revokes an unredeemed grant at the current time', async () => {
    const { grants, service } = await setup();
    expect(Effect.runSync(service.execute({ id: 'grant' }))).toEqual({
      kind: 'revoked',
    });
    expect(
      (await Effect.runPromise(grants.find({ grantId: 'grant' })))?.revokedAt,
    ).toBe('2026-09-23T10:05:00.000Z');
  });

  it('keeps the first revocation time when the grant is revoked again', async () => {
    const { grants, clock, service } = await setup();
    Effect.runSync(service.execute({ id: 'grant' }));
    await Effect.runPromise(
      clock.setTime(Date.parse('2026-09-23T10:06:00.000Z')),
    );
    expect(Effect.runSync(service.execute({ id: 'grant' }))).toEqual({
      kind: 'not-revoked',
    });
    expect(
      (await Effect.runPromise(grants.find({ grantId: 'grant' })))?.revokedAt,
    ).toBe('2026-09-23T10:05:00.000Z');
  });

  it('revokes a grant that has already expired', async () => {
    const { service } = await setup({ expiresAt: '2026-09-23T10:01:00.000Z' });
    expect(Effect.runSync(service.execute({ id: 'grant' }))).toEqual({
      kind: 'revoked',
    });
  });

  it('leaves a redeemed grant alone', async () => {
    const { grants, service } = await setup({
      redeemedAt: '2026-09-23T10:02:00.000Z',
    });
    expect(Effect.runSync(service.execute({ id: 'grant' }))).toEqual({
      kind: 'not-revoked',
    });
    expect(
      (await Effect.runPromise(grants.find({ grantId: 'grant' })))?.revokedAt,
    ).toBeUndefined();
  });

  it('reports an unknown id as not revoked', async () => {
    expect(
      Effect.runSync((await setup()).service.execute({ id: 'unknown' })),
    ).toEqual({
      kind: 'not-revoked',
    });
  });
});
