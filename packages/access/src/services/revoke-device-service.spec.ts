import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
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
    secretHash: 'hash',
  });
  const clock = new FixedClock('2026-09-23T10:05:00.000Z');
  return { devices, clock, service: new RevokeDeviceService(devices, clock) };
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
    clock.advance(60_000);
    expect(service.execute({ id: 'device' })).toEqual({ kind: 'not-revoked' });
    expect(devices.find({ deviceId: 'device' })?.revokedAt).toBe(
      '2026-09-23T10:05:00.000Z',
    );
  });

  it('reports an unknown id as not revoked', () => {
    expect(setup().service.execute({ id: 'unknown' })).toEqual({
      kind: 'not-revoked',
    });
  });
});
