import { describe, expect, it } from 'vitest';
import type { StoredDevice } from '@porcelain/access/models';
import { deviceRevoked, deviceUsable, sightingDue } from './device-activity.ts';

const lifetimeMs = 60_000;

function device(overrides: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id: 'device-1',
    label: 'Phone',
    platform: 'iOS',
    createdAt: '2026-09-24T10:00:00.000Z',
    lastSeenAt: '2026-09-24T10:00:00.000Z',
    secretHash: 'a'.repeat(64),
    ...overrides,
  };
}

describe('device activity', () => {
  it('counts a device as revoked once it carries a revocation time', () => {
    expect(deviceRevoked(device())).toBe(false);
    expect(
      deviceRevoked(device({ revokedAt: '2026-09-24T11:00:00.000Z' })),
    ).toBe(true);
  });

  it('refuses a revoked device even while it is fresh', () => {
    expect(
      deviceUsable(
        device({ revokedAt: '2026-09-24T10:00:10.000Z' }),
        '2026-09-24T10:00:20.000Z',
        lifetimeMs,
      ),
    ).toBe(false);
  });

  it('keeps a device usable until its unused lifetime runs out', () => {
    expect(deviceUsable(device(), '2026-09-24T10:00:59.999Z', lifetimeMs)).toBe(
      true,
    );
    expect(deviceUsable(device(), '2026-09-24T10:01:00.000Z', lifetimeMs)).toBe(
      false,
    );
  });

  it('records a new sighting only when time has passed since the last one', () => {
    expect(sightingDue(device(), '2026-09-24T10:00:00.000Z')).toBe(false);
    expect(sightingDue(device(), '2026-09-24T10:00:00.001Z')).toBe(true);
  });
});
