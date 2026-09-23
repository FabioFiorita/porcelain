import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { RevokeDeviceService } from './revoke-device-service.ts';

describe('RevokeDeviceService', () => {
  const devices = new InMemoryDeviceStore();
  devices.add({
    id: 'device',
    label: 'Phone',
    platform: 'iOS',
    createdAt: '2026-09-22T10:00:00.000Z',
    lastSeenAt: '2026-09-23T09:00:00.000Z',
    secretHash: 'hash',
  });
  const service = new RevokeDeviceService(
    devices,
    new FixedClock('2026-09-23T10:05:00.000Z'),
  );

  it('revokes a paired device once', () => {
    expect(service.execute({ id: 'device' })).toEqual({
      revoked: true,
      kind: 'device',
    });
    expect(devices.find('device')?.revokedAt).toBe('2026-09-23T10:05:00.000Z');
    expect(service.execute({ id: 'device' })).toEqual({ revoked: false });
  });

  it('reports an unknown id as not revoked', () => {
    expect(service.execute({ id: 'unknown' })).toEqual({ revoked: false });
  });
});
