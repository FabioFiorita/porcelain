import { testClock } from '@porcelain/kernel/test-kit';
import { DeviceStore, DeviceSightingStore } from '@porcelain/access/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryDeviceSightingStore } from '../../spec/fakes/in-memory-device-sighting-store.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { RevokeDeviceService } from './revoke-device-service.ts';

async function setup() {
  const devices = new InMemoryDeviceStore();
  devices.add({
    id: 'device',
    label: 'Phone',
    platform: 'iOS',
    createdAt: '2026-09-22T10:00:00.000Z',
    lastSeenAt: '2026-09-23T09:00:00.000Z',
    route: 'lan',
    secretHash: 'hash',
  });
  const sightings = new InMemoryDeviceSightingStore();
  const clock = await testClock('2026-09-23T10:05:00.000Z');
  return {
    devices,
    sightings,
    clock,
    service: Effect.runSync(
      RevokeDeviceService.pipe(
        Effect.provide(RevokeDeviceService.layer),
        Effect.provideService(DeviceStore, devices),
        Effect.provideService(DeviceSightingStore, sightings),
        Effect.provideService(Clock.Clock, clock),
      ),
    ),
  };
}

describe('RevokeDeviceService', () => {
  it('revokes a paired device at the current time', async () => {
    const { devices, service } = await setup();
    expect(Effect.runSync(service.execute({ id: 'device' }))).toEqual({
      kind: 'revoked',
    });
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'device' })))
        ?.revokedAt,
    ).toBe('2026-09-23T10:05:00.000Z');
  });

  it('keeps the first revocation time when the device is revoked again', async () => {
    const { devices, clock, service } = await setup();
    Effect.runSync(service.execute({ id: 'device' }));
    await Effect.runPromise(
      clock.setTime(Date.parse('2026-09-23T10:06:00.000Z')),
    );
    expect(Effect.runSync(service.execute({ id: 'device' }))).toEqual({
      kind: 'not-revoked',
    });
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'device' })))
        ?.revokedAt,
    ).toBe('2026-09-23T10:05:00.000Z');
  });

  it('drops the pending sighting of the device it revokes and keeps the sightings of other devices', async () => {
    const { sightings, service } = await setup();
    sightings.save({
      device: {
        id: 'device',
        label: 'Phone',
        platform: 'iOS',
        createdAt: '2026-09-22T10:00:00.000Z',
        lastSeenAt: '2026-09-23T10:00:00.000Z',
        route: 'lan',
        secretHash: 'hash',
      },
    });
    sightings.save({
      device: {
        id: 'tablet',
        label: 'Tablet',
        platform: 'iPadOS',
        createdAt: '2026-09-22T10:00:00.000Z',
        lastSeenAt: '2026-09-23T10:01:00.000Z',
        route: 'lan',
        secretHash: 'tablet-hash',
      },
    });
    Effect.runSync(service.execute({ id: 'device' }));
    expect(sightings.take()).toEqual([
      {
        id: 'tablet',
        label: 'Tablet',
        platform: 'iPadOS',
        createdAt: '2026-09-22T10:00:00.000Z',
        lastSeenAt: '2026-09-23T10:01:00.000Z',
        route: 'lan',
        secretHash: 'tablet-hash',
      },
    ]);
  });

  it('reports an unknown id as not revoked', async () => {
    expect(
      Effect.runSync((await setup()).service.execute({ id: 'unknown' })),
    ).toEqual({
      kind: 'not-revoked',
    });
  });
});
