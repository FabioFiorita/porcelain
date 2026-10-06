import { testClock } from '@porcelain/kernel/test-kit';
import {
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';
import {
  PairingGrantStore,
  RedeemPairingOptions,
} from '@porcelain/access/ports';
import { Redacted, Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  InvalidDeviceDetailsError,
  InvalidPairingError,
} from '@porcelain/access/errors';
import type { StoredPairingGrant } from '@porcelain/access/models';
import {
  credential,
  parseCredential,
  secretMatches,
} from '@porcelain/access/rules';
import { sha256Hex } from '@porcelain/kernel/rules';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { RedeemPairingService } from './redeem-pairing-service.ts';

const issuedAt = '2026-09-23T10:00:00.000Z';
const grantId = 'aaaaaaaa-0000-4000-8000-000000000001';
const secret = 'g'.repeat(43);

async function setup(grant: Partial<StoredPairingGrant> = {}) {
  const devices = new InMemoryDeviceStore();
  const grants = new InMemoryPairingGrantStore(devices);
  await Effect.runPromise(
    grants.add({
      grants: [
        {
          id: grantId,
          label: 'Phone',
          addresses: ['http://192.168.1.20:4173'],
          createdAt: issuedAt,
          expiresAt: '2026-09-23T10:15:00.000Z',
          secretHash: sha256Hex(secret),
          ...grant,
        },
      ],
    }),
  );
  const clock = await testClock('2026-09-23T10:05:00.000Z');
  const service = Effect.runSync(
    RedeemPairingService.pipe(
      Effect.provide(RedeemPairingService.layer),
      Effect.provideService(PairingGrantStore, grants),
      Effect.provideService(Clock.Clock, clock),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(SecretSource, new SequentialSecretSource()),
      Effect.provideService(RedeemPairingOptions, {
        labelLength: 80,
        platformLength: 120,
      }),
    ),
  );
  return {
    devices,
    grants,
    clock,
    service,
    code: Redacted.value(credential('pcp', grantId, secret).token),
  };
}

describe('RedeemPairingService', () => {
  it('turns a code into a device named after its grant', async () => {
    const { devices, service, code } = await setup();
    const { device, credential: issued } = Effect.runSync(
      service.execute({
        code,
        platform: 'iOS',
        route: 'lan',
      }),
    );
    expect(device).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      label: 'Phone',
      platform: 'iOS',
      createdAt: '2026-09-23T10:05:00.000Z',
      lastSeenAt: '2026-09-23T10:05:00.000Z',
      route: 'lan',
    });
    const parts = parseCredential('pcd', Redacted.value(issued));
    expect(parts?.id).toBe(device.id);
    const stored = await Effect.runPromise(
      devices.find({ deviceId: device.id }),
    );
    expect(
      secretMatches(
        stored?.secretHash ?? '',
        parts?.secret ?? Redacted.make(''),
      ),
    ).toBe(true);
  });

  it('pairs a trusted device from a trusted grant', async () => {
    const { devices, service, code } = await setup({ trusted: true });
    const { device } = Effect.runSync(
      service.execute({
        code,
        platform: 'macOS',
        route: 'lan',
      }),
    );
    expect(device.trusted).toBe(true);
    expect(
      (await Effect.runPromise(devices.find({ deviceId: device.id })))?.trusted,
    ).toBe(true);
  });

  it('pairs an untrusted device from an ordinary grant', async () => {
    const { devices, service, code } = await setup({ trusted: false });
    const { device } = Effect.runSync(
      service.execute({ code, platform: 'iOS', route: 'lan' }),
    );
    expect(device.trusted).toBeUndefined();
    expect(
      (await Effect.runPromise(devices.find({ deviceId: device.id })))?.trusted,
    ).toBeUndefined();
  });

  it.each(['loopback', 'tailnet', 'tunnel'] as const)(
    'binds the device to the route it was paired over, %s',
    async (route) => {
      const { devices, service, code } = await setup();
      const { device } = Effect.runSync(
        service.execute({ code, platform: 'iOS', route }),
      );
      expect(device.route).toBe(route);
      expect(
        (await Effect.runPromise(devices.find({ deviceId: device.id })))?.route,
      ).toBe(route);
    },
  );

  it('names the device with the label it submits, trimmed', async () => {
    const { service, code } = await setup();
    const { device } = Effect.runSync(
      service.execute({
        code,
        platform: ' Browser ',
        route: 'lan',
        label: ' Work laptop ',
      }),
    );
    expect(device).toMatchObject({ label: 'Work laptop', platform: 'Browser' });
  });

  it('consumes the code, so a second redemption is refused', async () => {
    const { devices, grants, service, code } = await setup();
    Effect.runSync(service.execute({ code, platform: 'iOS', route: 'lan' }));
    expect(
      (await Effect.runPromise(grants.find({ grantId })))?.redeemedAt,
    ).toBe('2026-09-23T10:05:00.000Z');
    expect(() =>
      Effect.runSync(service.execute({ code, platform: 'iOS', route: 'lan' })),
    ).toThrow(InvalidPairingError);
    expect(await Effect.runPromise(devices.list())).toHaveLength(1);
  });

  it.each([
    { name: 'a malformed code', attempt: 'pcp_unknown' },
    {
      name: 'an unknown grant',
      attempt: Redacted.value(
        credential('pcp', 'bbbbbbbb-0000-4000-8000-000000000002', secret).token,
      ),
    },
    {
      name: 'a wrong secret',
      attempt: Redacted.value(credential('pcp', grantId, 'w'.repeat(43)).token),
    },
    {
      name: 'a device credential',
      attempt: Redacted.value(credential('pcd', grantId, secret).token),
    },
  ])('refuses $name as an invalid pairing', async ({ attempt }) => {
    const { service } = await setup();
    expect(() =>
      Effect.runSync(
        service.execute({ code: attempt, platform: 'iOS', route: 'lan' }),
      ),
    ).toThrow(InvalidPairingError);
  });

  it('accepts a code until the moment it expires', async () => {
    const early = await setup();
    await Effect.runPromise(
      early.clock.setTime(Date.parse('2026-09-23T10:14:59.999Z')),
    );
    expect(
      Effect.runSync(
        early.service.execute({
          code: early.code,
          platform: 'iOS',
          route: 'lan',
        }),
      ).device.label,
    ).toBe('Phone');
    const late = await setup();
    await Effect.runPromise(
      late.clock.setTime(Date.parse('2026-09-23T10:15:00.000Z')),
    );
    expect(() =>
      Effect.runSync(
        late.service.execute({
          code: late.code,
          platform: 'iOS',
          route: 'lan',
        }),
      ),
    ).toThrow(InvalidPairingError);
  });

  it('refuses a code issued later than the current time', async () => {
    const { clock, service, code } = await setup();
    await Effect.runPromise(
      clock.setTime(Date.parse('2026-09-23T09:59:59.999Z')),
    );
    expect(() =>
      Effect.runSync(service.execute({ code, platform: 'iOS', route: 'lan' })),
    ).toThrow(InvalidPairingError);
  });

  it('refuses a revoked grant', async () => {
    const { service, code } = await setup({
      revokedAt: '2026-09-23T10:01:00.000Z',
    });
    expect(() =>
      Effect.runSync(service.execute({ code, platform: 'iOS', route: 'lan' })),
    ).toThrow(InvalidPairingError);
  });

  it('refuses invalid device details without consuming the code', async () => {
    const { devices, grants, service, code } = await setup();
    expect(() =>
      Effect.runSync(
        service.execute({ code, platform: 'iOS\u0007', route: 'lan' }),
      ),
    ).toThrow(InvalidDeviceDetailsError);
    expect(() =>
      Effect.runSync(
        service.execute({ code, platform: 'iOS', route: 'lan', label: '  ' }),
      ),
    ).toThrow(InvalidDeviceDetailsError);
    expect(
      (await Effect.runPromise(grants.find({ grantId })))?.redeemedAt,
    ).toBeUndefined();
    expect(await Effect.runPromise(devices.list())).toEqual([]);
  });
});
