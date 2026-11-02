import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { DeviceStore } from '../ports/device-store.ts';
import type { StoredDevice } from '../models/device.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { AuthorizeSharingService } from './authorize-sharing-service.ts';

it('grants remote administration only to current sharing managers, independently of update and ways-in permissions', async () => {
  const devices = new InMemoryDeviceStore();
  const base: StoredDevice = {
    id: 'manager',
    label: 'Mac',
    platform: 'macOS',
    route: 'tailnet',
    createdAt: '2026-11-01T00:00:00Z',
    lastSeenAt: '2026-11-01T00:00:00Z',
    secretHash: 'hash',
  };
  devices.add({ ...base, canManageSharing: true });
  devices.add({ ...base, id: 'legacy', trusted: true, canEditWaysIn: true });
  devices.add({
    ...base,
    id: 'revoked',
    canManageSharing: true,
    revokedAt: '2026-11-01T00:01:00Z',
  });
  const service = Effect.runSync(
    AuthorizeSharingService.pipe(
      Effect.provide(AuthorizeSharingService.layer),
      Effect.provideService(DeviceStore, devices),
    ),
  );
  const allowed = (input: Parameters<typeof service.execute>[0]) =>
    service.execute(input).pipe(Effect.isSuccess);
  const answers = await Effect.runPromise(
    Effect.all([
      allowed({
        viewer: { kind: 'owner' },
        local: false,
        route: 'loopback',
      }),
      allowed({
        viewer: { kind: 'device', deviceId: 'local' },
        local: true,
        route: 'loopback',
      }),
      allowed({
        viewer: { kind: 'device', deviceId: 'manager' },
        local: false,
        route: 'tailnet',
      }),
      allowed({
        viewer: { kind: 'device', deviceId: 'legacy' },
        local: false,
        route: 'tailnet',
      }),
      allowed({
        viewer: { kind: 'device', deviceId: 'revoked' },
        local: true,
        route: 'loopback',
      }),
      allowed({
        viewer: { kind: 'device', deviceId: 'unknown' },
        local: false,
        route: 'lan',
      }),
      allowed({
        viewer: { kind: 'device', deviceId: 'manager' },
        local: false,
        route: 'loopback',
      }),
    ]),
  );
  expect(answers).toEqual([true, true, true, false, false, false, false]);
  await Effect.runPromise(
    devices.recordManagementPermission({ device: base, allowed: false }),
  );
  expect(
    await Effect.runPromise(
      allowed({
        viewer: { kind: 'device', deviceId: 'manager' },
        local: false,
        route: 'tailnet',
      }),
    ),
  ).toBe(false);
});
