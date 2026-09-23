import { describe, expect, it } from 'vitest';
import { hashSecret, mintCredential } from '@porcelain/access/rules';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { AuthenticateDeviceService } from './authenticate-device-service.ts';

const deviceId = '00000000-0000-4000-8000-000000000001';
const lastSeenAt = '2026-09-23T10:00:00.000Z';
const day = 24 * 60 * 60 * 1000;

function setup(device: { revokedAt?: string; createdAt?: string } = {}) {
  const devices = new InMemoryDeviceStore();
  const credential = mintCredential('pcd', deviceId);
  devices.add({
    id: deviceId,
    label: 'Phone',
    platform: 'iOS',
    createdAt: '2026-09-01T10:00:00.000Z',
    lastSeenAt,
    lastSeenAddress: '192.168.1.30',
    secretHash: hashSecret(credential.secret),
    ...device,
  });
  const clock = new FixedClock('2026-09-23T10:00:05.000Z');
  const service = new AuthenticateDeviceService(devices, clock);
  return { devices, clock, service, credential: credential.token };
}

describe('AuthenticateDeviceService', () => {
  it('recognises a paired device and reports how long it was idle', () => {
    const { service, credential } = setup();
    expect(service.execute({ credential, address: '192.168.1.40' })).toEqual({
      deviceId,
      idleMs: 5000,
    });
  });

  it('records when and from where the device was last seen', () => {
    const { devices, clock, service, credential } = setup();
    service.execute({ credential, address: '192.168.1.40' });
    expect(devices.find(deviceId)).toMatchObject({
      lastSeenAt: '2026-09-23T10:00:05.000Z',
      lastSeenAddress: '192.168.1.40',
    });
    clock.advance(1000);
    service.execute({ credential });
    expect(devices.find(deviceId)?.lastSeenAddress).toBeUndefined();
  });

  it('leaves the last sighting alone when no time has passed', () => {
    const { devices, clock, service, credential } = setup();
    clock.at = lastSeenAt;
    expect(service.execute({ credential, address: '10.0.0.1' })?.idleMs).toBe(
      0,
    );
    expect(devices.find(deviceId)?.lastSeenAddress).toBe('192.168.1.30');
  });

  it('refuses a malformed credential, an unknown device and a wrong secret', () => {
    const { service, credential } = setup();
    const attempts = [
      'pcd_unknown',
      credential.replace('pcd_', 'pcp_'),
      mintCredential('pcd', '00000000-0000-4000-8000-000000000002').token,
      mintCredential('pcd', deviceId).token,
    ];
    for (const attempt of attempts)
      expect(service.execute({ credential: attempt })).toBeUndefined();
  });

  it('refuses a revoked device', () => {
    const { service, credential } = setup({
      revokedAt: '2026-09-22T10:00:00.000Z',
    });
    expect(service.execute({ credential })).toBeUndefined();
  });

  it('refuses a device left unused for ninety days', () => {
    const fresh = setup();
    fresh.clock.at = new Date(
      Date.parse(lastSeenAt) + 90 * day - 1,
    ).toISOString();
    expect(
      fresh.service.execute({ credential: fresh.credential })?.deviceId,
    ).toBe(deviceId);
    const stale = setup();
    stale.clock.at = new Date(Date.parse(lastSeenAt) + 90 * day).toISOString();
    expect(
      stale.service.execute({ credential: stale.credential }),
    ).toBeUndefined();
  });

  it('refuses a device whose records lie in the future of the clock', () => {
    const seenLater = setup();
    seenLater.clock.at = '2026-09-23T09:59:59.999Z';
    expect(
      seenLater.service.execute({ credential: seenLater.credential }),
    ).toBeUndefined();
    const createdLater = setup({ createdAt: '2026-09-24T00:00:00.000Z' });
    expect(
      createdLater.service.execute({ credential: createdLater.credential }),
    ).toBeUndefined();
  });

  it('keeps an unused device usable when it authenticates again in time', () => {
    const { clock, service, credential } = setup();
    clock.advance(89 * day);
    service.execute({ credential });
    clock.advance(89 * day);
    expect(service.execute({ credential })?.deviceId).toBe(deviceId);
  });
});
