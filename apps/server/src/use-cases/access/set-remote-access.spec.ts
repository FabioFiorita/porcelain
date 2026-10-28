import { NodeServices } from '@effect/platform-node';
import {
  DeviceStore,
  NetworkAddressReader,
  PairingGrantStore,
  RemoteAccessOptions,
  RemoteAccessStore,
  RuntimeStatusReader,
} from '@porcelain/access/ports';
import type { StoredDevice } from '@porcelain/access/models';
import {
  AuthorizeWaysInService,
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
  ReadRemoteAccessService,
  RevokeDeviceService,
  RevokePairingGrantService,
  SetRemoteAccessService,
  SetWaysInPermissionService,
} from '@porcelain/access/services';
import { storageLayer } from '@porcelain/storage';
import { Deferred, Effect, Exit, Fiber, Layer, ManagedRuntime } from 'effect';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cachedDeviceStoreLayer } from '../../adapters/access/cached-device-store.ts';
import { inMemoryDeviceSightingStoreLayer } from '../../adapters/access/in-memory-device-sighting-store.ts';
import { inMemoryRouteStateStoreLayer } from '../../adapters/access/in-memory-route-state-store.ts';
import { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import { Logger } from '../../ports/logger.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { RevokeAccessUseCase } from './revoke-access.ts';
import { SetRemoteAccessUseCase } from './set-remote-access.ts';
import { SetWaysInPermissionUseCase } from './set-ways-in-permission.ts';

const phone: StoredDevice = {
  id: 'phone',
  label: 'Phone',
  platform: 'iOS',
  createdAt: '2026-10-20T10:00:00.000Z',
  lastSeenAt: '2026-10-20T10:00:00.000Z',
  route: 'lan',
  secretHash: 'hash-phone',
};
const tailnetHostname = 'laptop.tail0000.ts.net';
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

function computer() {
  const finds: Deferred.Deferred<void>[] = [];
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-ways-in-race-'));
  const storage = storageLayer(dataDirectory, {
    worktreeIdLength: 32,
    busyTimeoutMs: 5000,
  }).pipe(Layer.provide(NodeServices.layer));
  const devices = Layer.effect(
    DeviceStore,
    Effect.gen(function* () {
      const cached = yield* DeviceStore;
      return DeviceStore.of({
        ...cached,
        find: (input) =>
          cached
            .find(input)
            .pipe(
              Effect.tap(() =>
                Effect.forEach(finds.splice(0), (found) =>
                  Deferred.succeed(found, undefined),
                ),
              ),
            ),
      });
    }),
  ).pipe(Layer.provide(cachedDeviceStoreLayer), Layer.provideMerge(storage));
  const domain = Layer.mergeAll(
    SetRemoteAccessService.layer,
    ReadRemoteAccessService.layer,
    SetWaysInPermissionService.layer,
    RevokeDeviceService.layer,
    RevokePairingGrantService.layer,
  ).pipe(
    Layer.provideMerge(AuthorizeWaysInService.layer),
    Layer.provide([
      inMemoryRouteStateStoreLayer,
      inMemoryDeviceSightingStoreLayer,
      Layer.succeed(NetworkAddressReader, {
        list: () => [],
        defaultRoutes: () => Effect.succeed([]),
      }),
      Layer.succeed(RuntimeStatusReader, {
        current: () => ({
          address: 'http://127.0.0.1:4173',
          dataDirectory,
          pid: 1,
        }),
      }),
      Layer.succeed(RemoteAccessOptions, { hostnameLength: 253 }),
    ]),
  );
  const lanes = Lanes.layer.pipe(
    Layer.provide(
      Layer.succeed(LaneOptions, {
        readCapacity: 2,
        deadlineMs: 10_000,
        consistency: { execute: () => Effect.void },
      }),
    ),
  );
  const useCases = Layer.mergeAll(
    SetRemoteAccessUseCase.layer,
    SetWaysInPermissionUseCase.layer,
    RevokeAccessUseCase.layer,
  ).pipe(
    Layer.provideMerge(Layer.mergeAll(domain, lanes, LaneKeys.layer)),
    Layer.provide([
      Layer.succeed(OpenRemoteRoutesService, { execute: () => Effect.void }),
      Layer.succeed(CloseTunnelConnectionsService, {
        execute: () => Effect.void,
      }),
      Layer.succeed(ReadEnvironmentService, {
        execute: () => Effect.die('the route check does not run in this test'),
      }),
      Layer.succeed(Logger, { failure: () => undefined }),
      Layer.succeed(DeviceConnectionStore, {
        insert: () => () => undefined,
        remove: () => undefined,
      }),
    ]),
    Layer.provideMerge(devices),
  );
  const runtime = ManagedRuntime.make(useCases);
  cleanups.push(async () => {
    await runtime.dispose();
    rmSync(dataDirectory, { recursive: true, force: true });
  });
  return {
    runtime,
    nextFind: Effect.gen(function* () {
      const found = yield* Deferred.make<void>();
      finds.push(found);
      return found;
    }),
  };
}

const withdrawals = [
  [
    'the owner removes its permission',
    Effect.flatMap(SetWaysInPermissionUseCase, (permission) =>
      permission.execute({ id: phone.id, allowed: false }),
    ),
    false,
  ],
  [
    'the owner revokes it',
    Effect.flatMap(RevokeAccessUseCase, (revoke) =>
      revoke.execute({ id: phone.id }),
    ),
    false,
  ],
  ['the owner leaves it alone', Effect.void, true],
] as const;

describe('SetRemoteAccessUseCase', () => {
  it.each(withdrawals)(
    'a device save queued behind the route check after its look at the ways in is saved only while it still may edit them, when %s',
    async (_name, withdraw, saves) => {
      const { runtime, nextFind } = computer();
      const outcome = await runtime.runPromise(
        Effect.gen(function* () {
          const grants = yield* PairingGrantStore;
          yield* grants.redeem({
            grant: {
              id: 'grant-phone',
              label: phone.label,
              addresses: [],
              createdAt: phone.createdAt,
              expiresAt: phone.createdAt,
              secretHash: 'grant-hash-phone',
            },
            redeemedAt: phone.createdAt,
            device: phone,
          });
          yield* (yield* SetWaysInPermissionUseCase).execute({
            id: phone.id,
            allowed: true,
          });
          const { fingerprint } =
            yield* (yield* ReadRemoteAccessService).execute();
          const lanes = yield* Lanes;
          const keys = yield* LaneKeys;
          const routeCheck = yield* Deferred.make<void>();
          const routeChecked = yield* Deferred.make<void>();
          yield* lanes.background(
            keys.remoteAccess(),
            () =>
              Deferred.succeed(routeCheck, undefined).pipe(
                Effect.andThen(Deferred.await(routeChecked)),
              ),
            () => Effect.void,
          );
          yield* Deferred.await(routeCheck);
          const authorized = yield* nextFind;
          const save = yield* Effect.forkChild(
            (yield* SetRemoteAccessUseCase).execute({
              expected: fingerprint,
              change: { tailnet: true, tailnetHostname },
              viewer: { kind: 'device', deviceId: phone.id },
              local: false,
              route: 'lan',
            }),
          );
          yield* Deferred.await(authorized);
          yield* withdraw;
          yield* Deferred.succeed(routeChecked, undefined);
          const saved = yield* Fiber.await(save);
          const settings = yield* (yield* RemoteAccessStore).read();
          return { saved, tailnet: settings.tailnet };
        }),
      );

      expect(Exit.isSuccess(outcome.saved)).toBe(saves);
      if (Exit.isFailure(outcome.saved))
        expect(String(outcome.saved.cause)).toContain(
          'WaysInPermissionRequiredError',
        );
      expect(outcome.tailnet).toBe(saves);
    },
  );
});
