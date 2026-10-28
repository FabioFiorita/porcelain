import { DeviceStore } from '@porcelain/access/ports';
import { Effect, Exit } from 'effect';
import { describe, expect, it } from 'vitest';
import type { StoredDevice, WaysInCaller } from '@porcelain/access/models';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { AuthorizeWaysInService } from './authorize-ways-in-service.ts';

function device(id: string, extra: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id,
    label: `Device ${id}`,
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
  const service = Effect.runSync(
    AuthorizeWaysInService.pipe(
      Effect.provide(AuthorizeWaysInService.layer),
      Effect.provideService(DeviceStore, devices),
    ),
  );
  return {
    devices,
    allowed: (caller: WaysInCaller) =>
      Exit.isSuccess(Effect.runSyncExit(service.execute(caller))),
  };
}

const asDevice = (
  deviceId: string,
  route: WaysInCaller['route'],
  local = false,
): WaysInCaller => ({
  viewer: { kind: 'device', deviceId },
  local,
  route,
});

describe('AuthorizeWaysInService', () => {
  it.each([
    [
      'the owner socket',
      { viewer: { kind: 'owner' }, local: false, route: 'lan' },
      true,
    ],
    [
      'a browser on this computer without the permission',
      asDevice('browser', 'loopback', true),
      true,
    ],
    [
      'a device the owner let edit ways in, over Tailscale',
      asDevice('allowed', 'tailnet'),
      true,
    ],
    [
      'a device the owner let edit ways in, over the local network',
      asDevice('allowed', 'lan'),
      true,
    ],
    [
      'a device the owner let edit ways in, through the tunnel',
      asDevice('allowed', 'tunnel'),
      true,
    ],
    [
      'a trusted device without the permission',
      asDevice('trusted', 'tailnet'),
      false,
    ],
    ['a device without the permission', asDevice('plain', 'lan'), false],
    [
      'a revoked device that had the permission',
      asDevice('revoked', 'tailnet'),
      false,
    ],
    [
      'a revoked browser on this computer',
      asDevice('revoked-browser', 'loopback', true),
      false,
    ],
    ['an unknown device', asDevice('unknown', 'tailnet'), false],
    [
      "the desktop app's own session on this computer, which has no paired device record",
      asDevice('desktop-session', 'loopback', true),
      true,
    ],
    [
      'a relayed request on the loopback address, even with the permission',
      asDevice('allowed-loopback', 'loopback'),
      false,
    ],
  ] as const)('%s: allowed %s', (_name, caller, expected) => {
    const { allowed } = setup(
      device('browser', { route: 'loopback' }),
      device('allowed', { canEditWaysIn: true }),
      device('trusted', { trusted: true }),
      device('plain', { route: 'lan' }),
      device('revoked', {
        canEditWaysIn: true,
        revokedAt: '2026-10-25T10:00:00.000Z',
      }),
      device('revoked-browser', {
        route: 'loopback',
        revokedAt: '2026-10-25T10:00:00.000Z',
      }),
      device('allowed-loopback', { route: 'loopback', canEditWaysIn: true }),
    );
    expect(allowed(caller)).toBe(expected);
  });

  it('follows the owner granting and removing the permission', async () => {
    const { devices, allowed } = setup(device('phone'));
    const caller = asDevice('phone', 'tailnet');
    expect(allowed(caller)).toBe(false);
    await Effect.runPromise(
      devices.recordWaysInPermission({
        device: device('phone'),
        allowed: true,
      }),
    );
    expect(allowed(caller)).toBe(true);
    await Effect.runPromise(
      devices.recordWaysInPermission({
        device: device('phone'),
        allowed: false,
      }),
    );
    expect(allowed(caller)).toBe(false);
  });
});
