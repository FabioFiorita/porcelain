import { afterEach, expect, inject } from 'vitest';
import { Redacted, Schema } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { readEnvironmentResponseSchema } from '@porcelain/contracts/access';
import { test } from '@porcelain/server/kit/server-test';
import { IsolatedServer } from '@porcelain/server/kit/isolated-server';
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
      path: '/api/environment',
      authorization: `Bearer ${server.credential}`,
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
