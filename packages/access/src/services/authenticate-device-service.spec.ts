import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type { StoredDevice } from '@porcelain/access/models';
import { credential, hashSecret } from '@porcelain/access/rules';
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
    secretHash: hashSecret(secret),
    ...device,
  });
  const clock = new FixedClock('2026-09-23T10:00:05.000Z');
  const service = new AuthenticateDeviceService(devices, clock, {
    unusedLifetimeMs,
  });
  return {
    devices,
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

  it('records when and from where the device was last seen', () => {
    const { devices, clock, service, token } = setup();
    service.execute({ credential: token, address: '192.168.1.40' });
    expect(devices.find({ deviceId })).toMatchObject({
      lastSeenAt: '2026-09-23T10:00:05.000Z',
      lastSeenAddress: '192.168.1.40',
    });
    clock.advance(1000);
    service.execute({ credential: token });
    expect(devices.find({ deviceId })?.lastSeenAt).toBe(
      '2026-09-23T10:00:06.000Z',
    );
    expect(devices.find({ deviceId })?.lastSeenAddress).toBeUndefined();
  });

  it('leaves the last sighting alone when no time has passed', () => {
    const { devices, clock, service, token } = setup();
    clock.set(lastSeenAt);
    expect(service.execute({ credential: token, address: '10.0.0.1' })).toEqual(
      { kind: 'authenticated', deviceId },
    );
    expect(devices.find({ deviceId })?.lastSeenAddress).toBe('192.168.1.30');
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
    clock.advance(89 * day);
    service.execute({ credential: token });
    clock.advance(89 * day);
    expect(service.execute({ credential: token })).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });
});
