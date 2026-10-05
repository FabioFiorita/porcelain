import { Clock } from '@porcelain/kernel/ports';
import {
  DeviceStore,
  DeviceSightingStore,
  AuthenticateDeviceOptions,
} from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type { StoredDevice } from '@porcelain/access/models';
import { credential } from '@porcelain/access/rules';
import { sha256Hex } from '@porcelain/kernel/rules';
import { InMemoryDeviceSightingStore } from '../../spec/fakes/in-memory-device-sighting-store.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { AuthenticateDeviceService } from './authenticate-device-service.ts';

const deviceId = '00000000-0000-4000-8000-000000000001';
const secret = 's'.repeat(43);
const lastSeenAt = '2026-09-23T10:00:00.000Z';
const day = 24 * 60 * 60 * 1000;
const unusedLifetimeMs = 90 * day;

function setup(device: Partial<StoredDevice> = {}) {
  const devices = new InMemoryDeviceStore();
  devices.add({
    id: deviceId,
    label: 'Phone',
    platform: 'iOS',
    createdAt: '2026-09-01T10:00:00.000Z',
    lastSeenAt,
    lastSeenAddress: '192.168.1.30',
    route: 'lan',
    secretHash: sha256Hex(secret),
    ...device,
  });
  const sightings = new InMemoryDeviceSightingStore();
  const clock = new FixedClock('2026-09-23T10:00:05.000Z');
  const service = Effect.runSync(
    AuthenticateDeviceService.pipe(
      Effect.provide(AuthenticateDeviceService.layer),
      Effect.provideService(DeviceStore, devices),
      Effect.provideService(DeviceSightingStore, sightings),
      Effect.provideService(Clock, clock),
      Effect.provideService(AuthenticateDeviceOptions, {
        unusedLifetimeMs,
      }),
    ),
  );
  return {
    devices,
    sightings,
    clock,
    service,
    token: credential('pcd', deviceId, secret).token,
  };
}

function at(instant: string, offsetMs: number): string {
  return new Date(Date.parse(instant) + offsetMs).toISOString();
}

describe('AuthenticateDeviceService', () => {
  it('recognises a paired device by its credential', () => {
    const { service, token } = setup();
    expect(
      Effect.runSync(
        service.execute({
          credential: token,
          route: 'lan',
          address: '10.0.0.1',
        }),
      ),
    ).toEqual({ kind: 'authenticated', deviceId });
  });

  it('keeps when and from where the device was last seen as a pending sighting, not yet stored', () => {
    const { devices, sightings, clock, service, token } = setup();
    Effect.runSync(
      service.execute({
        credential: token,
        route: 'lan',
        address: '192.168.1.40',
      }),
    );
    expect(sightings.find({ deviceId })).toMatchObject({
      lastSeenAt: '2026-09-23T10:00:05.000Z',
      lastSeenAddress: '192.168.1.40',
    });
    expect(devices.find({ deviceId })?.lastSeenAt).toBe(lastSeenAt);
    clock.set('2026-09-23T10:00:06.000Z');
    Effect.runSync(service.execute({ credential: token, route: 'lan' }));
    expect(sightings.find({ deviceId })?.lastSeenAt).toBe(
      '2026-09-23T10:00:06.000Z',
    );
    expect(sightings.find({ deviceId })?.lastSeenAddress).toBeUndefined();
  });

  it('leaves the last sighting alone when no time has passed', () => {
    const { sightings, clock, service, token } = setup();
    clock.set(lastSeenAt);
    expect(
      Effect.runSync(
        service.execute({
          credential: token,
          route: 'lan',
          address: '10.0.0.1',
        }),
      ),
    ).toEqual({ kind: 'authenticated', deviceId });
    expect(sightings.find({ deviceId })).toBeUndefined();
  });

  it('measures the unused lifetime from the pending sighting when there is one', () => {
    const { sightings, clock, service, token } = setup();
    Effect.runSync(service.execute({ credential: token, route: 'lan' }));
    clock.set(at('2026-09-23T10:00:05.000Z', unusedLifetimeMs - 1));
    expect(sightings.find({ deviceId })).toBeDefined();
    expect(
      Effect.runSync(service.execute({ credential: token, route: 'lan' })),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });

  it.each([
    { name: 'a malformed credential', attempt: 'pcd_unknown' },
    {
      name: 'a pairing code',
      attempt: credential('pcp', deviceId, secret).token,
    },
    {
      name: 'an unknown device',
      attempt: credential('pcd', '00000000-0000-4000-8000-000000000002', secret)
        .token,
    },
    {
      name: 'a wrong secret',
      attempt: credential('pcd', deviceId, 'w'.repeat(43)).token,
    },
  ])('refuses $name', ({ attempt }) => {
    const { service } = setup();
    expect(
      Effect.runSync(service.execute({ credential: attempt, route: 'lan' })),
    ).toEqual({
      kind: 'refused',
    });
  });

  it.each(['loopback', 'tailnet', 'tunnel'] as const)(
    'refuses the credential of a device paired over the local network when it arrives over %s, and records no sighting',
    (route) => {
      const { sightings, service, token } = setup();
      expect(
        Effect.runSync(
          service.execute({ credential: token, route, address: '10.0.0.1' }),
        ),
      ).toEqual({ kind: 'refused' });
      expect(sightings.find({ deviceId })).toBeUndefined();
    },
  );

  it('accepts a device only over the route it is bound to, whichever that is', () => {
    const { service, token } = setup({ route: 'tunnel' });
    expect(
      Effect.runSync(service.execute({ credential: token, route: 'tunnel' })),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
    expect(
      Effect.runSync(service.execute({ credential: token, route: 'lan' })),
    ).toEqual({
      kind: 'refused',
    });
  });

  it('refuses a revoked device', () => {
    const { service, token } = setup({
      revokedAt: '2026-09-22T10:00:00.000Z',
    });
    expect(
      Effect.runSync(service.execute({ credential: token, route: 'lan' })),
    ).toEqual({
      kind: 'refused',
    });
  });

  it('refuses a device left unused for its whole unused lifetime', () => {
    const fresh = setup();
    fresh.clock.set(at(lastSeenAt, unusedLifetimeMs - 1));
    expect(
      Effect.runSync(
        fresh.service.execute({ credential: fresh.token, route: 'lan' }),
      ),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
    const stale = setup();
    stale.clock.set(at(lastSeenAt, unusedLifetimeMs));
    expect(
      Effect.runSync(
        stale.service.execute({ credential: stale.token, route: 'lan' }),
      ),
    ).toEqual({
      kind: 'refused',
    });
  });

  it('refuses a device whose records lie in the future of the clock', () => {
    const seenLater = setup();
    seenLater.clock.set('2026-09-23T09:59:59.999Z');
    expect(
      Effect.runSync(
        seenLater.service.execute({
          credential: seenLater.token,
          route: 'lan',
        }),
      ),
    ).toEqual({
      kind: 'refused',
    });
    const createdLater = setup({ createdAt: '2026-09-24T00:00:00.000Z' });
    expect(
      Effect.runSync(
        createdLater.service.execute({
          credential: createdLater.token,
          route: 'lan',
        }),
      ),
    ).toEqual({ kind: 'refused' });
  });

  it('keeps a device usable while it authenticates again within its lifetime', () => {
    const { clock, service, token } = setup();
    clock.set('2026-12-21T10:00:05.000Z');
    Effect.runSync(service.execute({ credential: token, route: 'lan' }));
    clock.set('2027-03-20T10:00:05.000Z');
    expect(
      Effect.runSync(service.execute({ credential: token, route: 'lan' })),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });
});
