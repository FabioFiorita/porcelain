import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { afterEach, expect, inject } from 'vitest';
import { Redacted, Schema, Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import {
  readEnvironmentResponseSchema,
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import { test } from '@porcelain/server/kit/server-test';
import { createRouteTransport } from '../../src/features/access/store/route-transport.ts';
import { pairEnvironment } from '../../src/features/access/commands/pairing.ts';
import {
  AccessStore,
  AccessPlatform,
  EnvironmentStorage,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import {
  IsolatedServer,
  Recorder,
} from '@porcelain/server/kit/isolated-server';
import {
  readRemoteStatus,
  remoteStatusResult,
  revalidateRemoteStatus,
  type AccessPlatformValue,
} from '@porcelain/client/access';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const onCleanup = (cleanup: () => void | Promise<void>) => {
  cleanups.push(cleanup);
};

const root = new URL('../../../../', import.meta.url).pathname;

test('real hosts recover automatically from outage and substitution without accepting another identity', async ({
  server,
}) => {
  const substitute = await IsolatedServer.start(root, inject('serverBuild'));
  onCleanup(async () => {
    await substitute.stop();
  });
  const environment = Schema.decodeUnknownSync(readEnvironmentResponseSchema)(
    await (await fetch(new URL('/api/environment', server.address))).json(),
  );
  const remote = {
    environmentId: environment.environmentId,
    name: environment.name,
    address: server.address,
    credential: Redacted.make(server.credential),
  };
  let active = true;
  let available = true;
  let target = server.address;
  const listeners = new Set<() => void>();
  const sent: {
    target: string;
    path: string;
    authorization: string | null;
    status: number;
  }[] = [];
  const platform: AccessPlatformValue = {
    name: () => 'Integration client',
    statusActivity: {
      isActive: () => active,
      subscribe: (changed) => {
        listeners.add(changed);
        return () => {
          listeners.delete(changed);
        };
      },
    },
    send: async (address, init) => {
      if (!available) throw new TypeError('Controlled host outage');
      const response = await fetch(new URL(address.pathname, target), init);
      sent.push({
        target,
        path: address.pathname,
        authorization: new Headers(init?.headers).get('authorization'),
        status: response.status,
      });
      return response;
    },
  };
  const registry = AtomRegistry.make();
  onCleanup(() => registry.dispose());
  const atom = readRemoteStatus(platform, remote);
  const stop = registry.mount(atom);
  const status = () => remoteStatusResult(remote, registry.get(atom));
  await expect.poll(() => status().kind).toBe('online');
  available = false;
  revalidateRemoteStatus(platform, remote);
  await expect.poll(() => status().kind).toBe('offline');
  active = false;
  for (const changed of listeners) changed();
  available = true;
  active = true;
  for (const changed of listeners) changed();
  await expect.poll(() => status().kind).toBe('online');
  target = substitute.address;
  revalidateRemoteStatus(platform, remote);
  await expect.poll(() => status().kind).toBe('other-server');
  expect(
    sent.filter((request) => request.target === substitute.address),
  ).toEqual([
    {
      target: substitute.address,
      path: '/api/health',
      authorization: null,
      status: 200,
    },
  ]);
  target = server.address;
  revalidateRemoteStatus(platform, remote);
  await expect.poll(() => status().kind).toBe('online');
  expect(status()).toEqual({
    kind: 'online',
    name: environment.name,
    version: environment.version,
  });
  expect(
    sent
      .filter((request) => request.path === '/api/session')
      .map((request) => request.status),
  ).toEqual([200, 200, 200]);
  stop();
  await expect.poll(() => listeners.size).toBe(0);
});

test('pairing two real endpoints retains both devices and falls back without replacing the environment', async ({
  server,
}) => {
  const recorder = new Recorder();
  let persisted: readonly Remote[] = [];
  const store = Effect.runSync(
    AccessStore.pipe(
      Effect.provide(AccessStore.layer),
      Effect.provideService(EnvironmentStorage, {
        read: () => Effect.succeed([...persisted]),
        write: (remotes) =>
          Effect.sync(() => {
            persisted = remotes;
          }),
      }),
    ),
  );
  await Effect.runPromise(store.load());
  const alternate = new URL(server.address);
  alternate.hostname = 'localhost';
  const addresses = [server.address, alternate.origin];
  const devices: string[] = [];
  for (const address of addresses) {
    const issued = Schema.decodeUnknownSync(issuePairingResponseSchema)(
      (
        await server.read(recorder, {
          method: 'POST',
          path: '/pairings',
          target: 'owner',
          body: { labels: ['Alternate endpoint'], addresses: [address] },
        })
      ).body,
    );
    const grant = issued.grants[0];
    if (!grant) throw new Error('No pairing grant');
    recorder.secret(grant.code);
    const remote = await Effect.runPromise(
      pairEnvironment(
        pairingLink({
          addresses: [address],
          code: grant.code,
          environmentId: grant.link.environmentId,
        }),
      ).pipe(
        Effect.provideService(AccessStore, store),
        Effect.provideService(AccessPlatform, {
          name: () => 'Integration client',
          send: fetch,
        }),
      ),
    );
    if (!remote.deviceId) throw new Error('No paired device');
    devices.push(remote.deviceId);
  }
  expect(persisted).toHaveLength(1);
  expect(devices[0]).not.toBe(devices[1]);
  const remote = persisted[0];
  if (!remote) throw new Error('No saved environment');
  expect(remote.address).toBe(server.address);
  expect(remote.alternateRoutes?.[0]?.address).toBe(alternate.origin);
  let primaryAvailable = false;
  const routing = createRouteTransport(remote, (url, init) => {
    if (!primaryAvailable && url.origin === server.address)
      return Promise.reject(new TypeError('Controlled primary outage'));
    return fetch(url, init);
  });
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await (await routing.transport('/api/inventory')).json(),
  );
  expect(inventory.environmentId).toBe(remote.environmentId);
  expect(routing.active.value?.address).toBe(alternate.origin);
  primaryAvailable = true;
  await server.read(recorder, {
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: devices[0] },
  });
  await Effect.runPromise(routing.select(true));
  expect(routing.active.value?.address).toBe(alternate.origin);
  expect((await routing.transport('/api/inventory')).status).toBe(200);
});
