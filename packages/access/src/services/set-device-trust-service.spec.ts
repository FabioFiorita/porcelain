import { DeviceStore } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { DeviceNotFoundError } from '@porcelain/access/errors';
import type { StoredDevice } from '@porcelain/access/models';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { SetDeviceTrustService } from './set-device-trust-service.ts';

function device(id: string, extra: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id,
    label: `Phone ${id}`,
    platform: 'iOS',
    createdAt: '2026-09-22T10:00:00.000Z',
    lastSeenAt: '2026-09-23T09:00:00.000Z',
    route: 'tunnel',
    secretHash: `hash-${id}`,
    ...extra,
  };
}

function setup(...paired: StoredDevice[]) {
  const devices = new InMemoryDeviceStore();
  paired.forEach((entry) => devices.add(entry));
  return {
    devices,
    service: Effect.runSync(
      SetDeviceTrustService.pipe(
        Effect.provide(SetDeviceTrustService.layer),
        Effect.provideService(DeviceStore, devices),
      ),
    ),
  };
}

describe('SetDeviceTrustService', () => {
  it('trusts the asked device and leaves the others untrusted', async () => {
    const { devices, service } = setup(device('phone'), device('tablet'));
    expect(
      Effect.runSync(service.execute({ id: 'phone', trusted: true })),
    ).toEqual({
      id: 'phone',
      trusted: true,
    });
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'phone' })))?.trusted,
    ).toBe(true);
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'tablet' })))?.trusted,
    ).toBeUndefined();
  });

  it('stops trusting a trusted device', async () => {
    const { devices, service } = setup(device('phone', { trusted: true }));
    expect(
      Effect.runSync(service.execute({ id: 'phone', trusted: false })),
    ).toEqual({
      id: 'phone',
      trusted: false,
    });
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'phone' })))?.trusted,
    ).toBeUndefined();
  });

  it('answers the same when the device already has the asked trust', async () => {
    const { devices, service } = setup(device('phone', { trusted: true }));
    expect(
      Effect.runSync(service.execute({ id: 'phone', trusted: true })),
    ).toEqual({
      id: 'phone',
      trusted: true,
    });
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'phone' })))?.trusted,
    ).toBe(true);
  });

  it('refuses an unknown device and changes nothing', async () => {
    const { devices, service } = setup(device('phone'));
    expect(() =>
      Effect.runSync(service.execute({ id: 'stranger', trusted: true })),
    ).toThrow(DeviceNotFoundError);
    expect(await Effect.runPromise(devices.list())).toEqual([device('phone')]);
  });

  it('refuses a revoked device, so trust never outlives its access', async () => {
    const revoked = device('phone', { revokedAt: '2026-09-23T08:00:00.000Z' });
    const { devices, service } = setup(revoked);
    expect(() =>
      Effect.runSync(service.execute({ id: 'phone', trusted: true })),
    ).toThrow(DeviceNotFoundError);
    expect(
      (await Effect.runPromise(devices.find({ deviceId: 'phone' })))?.trusted,
    ).toBeUndefined();
  });
});
