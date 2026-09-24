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
    secretHash: sha256Hex(secret),
    ...device,
  });
  const sightings = new InMemoryDeviceSightingStore();
  const clock = new FixedClock('2026-09-23T10:00:05.000Z');
  const service = new AuthenticateDeviceService(devices, sightings, clock, {
    unusedLifetimeMs,
  });
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
    expect(service.execute({ credential: token, address: '10.0.0.1' })).toEqual(
      { kind: 'authenticated', deviceId },
    );
  });

  it('keeps when and from where the device was last seen as a pending sighting, not yet stored', () => {
    const { devices, sightings, clock, service, token } = setup();
    service.execute({ credential: token, address: '192.168.1.40' });
    expect(sightings.find({ deviceId })).toMatchObject({
      lastSeenAt: '2026-09-23T10:00:05.000Z',
      lastSeenAddress: '192.168.1.40',
    });
    expect(devices.find({ deviceId })?.lastSeenAt).toBe(lastSeenAt);
    clock.set('2026-09-23T10:00:06.000Z');
    service.execute({ credential: token });
    expect(sightings.find({ deviceId })?.lastSeenAt).toBe(
      '2026-09-23T10:00:06.000Z',
    );
    expect(sightings.find({ deviceId })?.lastSeenAddress).toBeUndefined();
  });

  it('leaves the last sighting alone when no time has passed', () => {
    const { sightings, clock, service, token } = setup();
    clock.set(lastSeenAt);
    expect(service.execute({ credential: token, address: '10.0.0.1' })).toEqual(
      { kind: 'authenticated', deviceId },
    );
    expect(sightings.find({ deviceId })).toBeUndefined();
  });

  it('measures the unused lifetime from the pending sighting when there is one', () => {
    const { sightings, clock, service, token } = setup();
    service.execute({ credential: token });
    clock.set(at('2026-09-23T10:00:05.000Z', unusedLifetimeMs - 1));
    expect(sightings.find({ deviceId })).toBeDefined();
    expect(service.execute({ credential: token })).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });

  it('refuses a malformed credential, a pairing code, an unknown device and a wrong secret', () => {
    const { service, token } = setup();
    const attempts = [
      'pcd_unknown',
      token.replace('pcd_', 'pcp_'),
      credential('pcd', '00000000-0000-4000-8000-000000000002', secret).token,
      credential('pcd', deviceId, 'w'.repeat(43)).token,
    ];
    for (const attempt of attempts)
      expect(service.execute({ credential: attempt })).toEqual({
        kind: 'refused',
      });
  });

  it('refuses a revoked device', () => {
    const { service, token } = setup({
      revokedAt: '2026-09-22T10:00:00.000Z',
    });
    expect(service.execute({ credential: token })).toEqual({
      kind: 'refused',
    });
  });

  it('refuses a device left unused for its whole unused lifetime', () => {
    const fresh = setup();
    fresh.clock.set(at(lastSeenAt, unusedLifetimeMs - 1));
    expect(fresh.service.execute({ credential: fresh.token })).toEqual({
      kind: 'authenticated',
      deviceId,
    });
    const stale = setup();
    stale.clock.set(at(lastSeenAt, unusedLifetimeMs));
    expect(stale.service.execute({ credential: stale.token })).toEqual({
      kind: 'refused',
    });
  });

  it('refuses a device whose records lie in the future of the clock', () => {
    const seenLater = setup();
    seenLater.clock.set('2026-09-23T09:59:59.999Z');
    expect(seenLater.service.execute({ credential: seenLater.token })).toEqual({
      kind: 'refused',
    });
    const createdLater = setup({ createdAt: '2026-09-24T00:00:00.000Z' });
    expect(
      createdLater.service.execute({ credential: createdLater.token }),
    ).toEqual({ kind: 'refused' });
  });

  it('keeps a device usable while it authenticates again within its lifetime', () => {
    const { clock, service, token } = setup();
    clock.set('2026-12-21T10:00:05.000Z');
    service.execute({ credential: token });
    clock.set('2027-03-20T10:00:05.000Z');
    expect(service.execute({ credential: token })).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });
});
