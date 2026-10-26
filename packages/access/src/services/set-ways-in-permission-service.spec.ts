import { DeviceStore } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { DeviceNotFoundError } from '@porcelain/access/errors';
import type { StoredDevice } from '@porcelain/access/models';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { SetWaysInPermissionService } from './set-ways-in-permission-service.ts';

function device(id: string, extra: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id,
    label: `Phone ${id}`,
    platform: 'iOS',
    createdAt: '2026-10-20T10:00:00.000Z',
    lastSeenAt: '2026-10-25T09:00:00.000Z',
    route: 'tailnet',
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
      SetWaysInPermissionService.pipe(
        Effect.provide(SetWaysInPermissionService.layer),
        Effect.provideService(DeviceStore, devices),
      ),
    ),
  };
}

async function stored(devices: InMemoryDeviceStore, deviceId: string) {
  return Effect.runPromise(devices.find({ deviceId }));
}

describe('SetWaysInPermissionService', () => {
  it('lets the asked device edit ways in, and leaves its trust and the other devices alone', async () => {
    const { devices, service } = setup(device('phone'), device('tablet'));

    expect(
      Effect.runSync(service.execute({ id: 'phone', allowed: true })),
    ).toEqual({ id: 'phone', allowed: true });
    expect(await stored(devices, 'phone')).toEqual({
      ...device('phone'),
      canEditWaysIn: true,
    });
    expect((await stored(devices, 'tablet'))?.canEditWaysIn).toBeUndefined();
  });

  it('takes the permission away again without touching trust', async () => {
    const { devices, service } = setup(
      device('phone', { trusted: true, canEditWaysIn: true }),
    );

    expect(
      Effect.runSync(service.execute({ id: 'phone', allowed: false })),
    ).toEqual({ id: 'phone', allowed: false });
    expect(await stored(devices, 'phone')).toEqual({
      ...device('phone'),
      trusted: true,
    });
  });

  it.each([
    ['an unknown device', 'missing'],
    ['a revoked device', 'revoked'],
  ])('refuses %s and changes nothing', async (_name, id) => {
    const { devices, service } = setup(
      device('revoked', { revokedAt: '2026-10-25T10:00:00.000Z' }),
    );

    await expect(
      Effect.runPromise(service.execute({ id, allowed: true })),
    ).rejects.toThrow(DeviceNotFoundError);
    expect((await stored(devices, 'revoked'))?.canEditWaysIn).toBeUndefined();
  });
});
