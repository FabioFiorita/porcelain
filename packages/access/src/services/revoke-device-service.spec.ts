import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { InMemoryDeviceSightingStore } from '../../spec/fakes/in-memory-device-sighting-store.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { RevokeDeviceService } from './revoke-device-service.ts';

function setup() {
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
  const clock = new FixedClock('2026-09-23T10:05:00.000Z');
  return {
    devices,
    sightings,
    clock,
    service: new RevokeDeviceService(devices, sightings, clock),
  };
}

describe('RevokeDeviceService', () => {
  it('revokes a paired device at the current time', () => {
    const { devices, service } = setup();
    expect(service.execute({ id: 'device' })).toEqual({ kind: 'revoked' });
    expect(devices.find({ deviceId: 'device' })?.revokedAt).toBe(
      '2026-09-23T10:05:00.000Z',
    );
  });

  it('keeps the first revocation time when the device is revoked again', () => {
    const { devices, clock, service } = setup();
    service.execute({ id: 'device' });
    clock.set('2026-09-23T10:06:00.000Z');
    expect(service.execute({ id: 'device' })).toEqual({ kind: 'not-revoked' });
    expect(devices.find({ deviceId: 'device' })?.revokedAt).toBe(
      '2026-09-23T10:05:00.000Z',
    );
  });

  it('drops the pending sighting of the device it revokes and keeps the sightings of other devices', () => {
    const { sightings, service } = setup();
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
    service.execute({ id: 'device' });
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

  it('reports an unknown id as not revoked', () => {
    expect(setup().service.execute({ id: 'unknown' })).toEqual({
      kind: 'not-revoked',
    });
  });
});
