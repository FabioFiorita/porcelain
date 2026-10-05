import { DeviceStore } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import type { StoredDevice } from '@porcelain/access/models';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { AuthorizeServiceUpdateService } from './authorize-service-update-service.ts';

function device(id: string, extra: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id,
    label: `Device ${id}`,
    platform: 'macOS',
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
      AuthorizeServiceUpdateService.pipe(
        Effect.provide(AuthorizeServiceUpdateService.layer),
        Effect.provideService(DeviceStore, devices),
      ),
    ),
  };
}

const remote = (deviceId: string) => ({
  viewer: { kind: 'device' as const, deviceId },
  local: false,
});

describe('AuthorizeServiceUpdateService', () => {
  it('lets a device the owner trusts update from anywhere it was paired', () => {
    const { service } = setup(device('desktop', { trusted: true }));
    expect(Effect.runSync(service.execute(remote('desktop')))).toEqual({
      canUpdate: true,
    });
  });

  it('refuses a paired device the owner has not trusted', () => {
    const { service } = setup(device('phone'));
    expect(Effect.runSync(service.execute(remote('phone')))).toEqual({
      canUpdate: false,
    });
  });

  it('lets any paired device update when it asks from a browser on this computer, as before trust existed', () => {
    const { service } = setup(device('browser', { route: 'loopback' }));
    expect(
      Effect.runSync(
        service.execute({
          viewer: { kind: 'device', deviceId: 'browser' },
          local: true,
        }),
      ),
    ).toEqual({ canUpdate: true });
  });

  it('lets the owner update', () => {
    expect(
      Effect.runSync(
        setup().service.execute({ viewer: { kind: 'owner' }, local: false }),
      ),
    ).toEqual({ canUpdate: true });
  });

  it('refuses a revoked device even though it was trusted', () => {
    const { service } = setup(
      device('desktop', {
        trusted: true,
        revokedAt: '2026-09-23T08:00:00.000Z',
      }),
    );
    expect(Effect.runSync(service.execute(remote('desktop')))).toEqual({
      canUpdate: false,
    });
  });

  it('refuses a device it does not know', () => {
    const { service } = setup(device('desktop', { trusted: true }));
    expect(Effect.runSync(service.execute(remote('stranger')))).toEqual({
      canUpdate: false,
    });
  });

  it('follows the owner changing their mind', () => {
    const { devices, service } = setup(device('desktop'));
    devices.recordTrust({ device: device('desktop'), trusted: true });
    expect(Effect.runSync(service.execute(remote('desktop')))).toEqual({
      canUpdate: true,
    });
    devices.recordTrust({ device: device('desktop'), trusted: false });
    expect(Effect.runSync(service.execute(remote('desktop')))).toEqual({
      canUpdate: false,
    });
  });
});
