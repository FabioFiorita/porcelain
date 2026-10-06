import { Cause, Effect, Exit } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { afterEach, describe, expect, it } from 'vitest';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { runRequest } from '@porcelain/client/transport';
import { pairBrowserSession, pairEnvironment } from './pairing.ts';
import {
  AccessStore,
  AccessPlatform,
  EnvironmentStorage,
  type AccessPlatformValue,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';

const registries = new Set<AtomRegistry.AtomRegistry>();
afterEach(() => {
  for (const registry of registries) registry.dispose();
  registries.clear();
});

it('does not send a browser pairing request after its caller has already cancelled', async () => {
  const registry = AtomRegistry.make();
  registries.add(registry);
  const paths: string[] = [];
  const command = pairBrowserSession({
    transport: (path) => {
      paths.push(path);
      return Promise.reject(
        new Error('Cancelled pairing must not reach transport.'),
      );
    },
    platform: { name: () => 'Browser' },
  });
  const controller = new AbortController();
  controller.abort();
  registry.set(command, {
    link: { code: 'cancelled', environmentId: 'installation' },
    signal: controller.signal,
  });
  const exit = await Effect.runPromiseExit(
    AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
  );
  expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  expect(paths).toEqual([]);
});

it('cancels the actual browser pairing transport before reading or publishing a workspace', async () => {
  const registry = AtomRegistry.make();
  registries.add(registry);
  const paths: string[] = [];
  const requested = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  let requestSignal: AbortSignal | null | undefined;
  const command = pairBrowserSession({
    transport: (path, init) => {
      paths.push(path);
      if (path === '/api/health')
        return Promise.resolve(
          Response.json({ status: 'ok', environmentId: 'installation' }),
        );
      requestSignal = init?.signal;
      requested.resolve();
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          'abort',
          () => {
            aborted.resolve();
            reject(requestSignal?.reason);
          },
          { once: true },
        );
      });
    },
    platform: { name: () => 'Browser' },
  });
  const controller = new AbortController();
  registry.set(command, {
    link: { code: 'cancelled', environmentId: 'installation' },
    signal: controller.signal,
  });
  const result = Effect.runPromiseExit(
    AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
  );
  await requested.promise;
  expect(requestSignal?.aborted).toBe(false);
  controller.abort();
  const exit = await result;
  await aborted.promise;
  expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  expect(requestSignal?.aborted).toBe(true);
  expect(paths).toEqual(['/api/health', '/api/pair']);
});

function fixture(
  environmentId = 'installation',
  protocol = ENVIRONMENT_PROTOCOL,
) {
  const saved: Remote[][] = [];
  const requests: {
    path: string;
    authorization: string | null;
    body: unknown;
  }[] = [];
  const store = Effect.runSync(
    AccessStore.pipe(
      Effect.provide(AccessStore.layer),
      Effect.provideService(EnvironmentStorage, {
        read: () => Effect.succeed([]),
        write: (remotes) =>
          Effect.sync(() => {
            saved.push([...remotes]);
          }),
      }),
    ),
  );
  const platform: AccessPlatformValue = {
    name: () => 'iOS',
    send: (url, init) => {
      requests.push({
        path: url.pathname,
        authorization: new Headers(init?.headers).get('authorization'),
        body:
          init?.body instanceof Uint8Array
            ? new TextDecoder().decode(init.body)
            : init?.body,
      });
      return Promise.resolve(
        Response.json(
          url.pathname === '/api/pair'
            ? {
                credential: 'paired-credential',
                device: {
                  id: 'device',
                  label: 'Phone',
                  platform: 'iOS',
                  createdAt: '2026-10-02T00:00:00Z',
                },
              }
            : url.pathname === '/api/session'
              ? { kind: 'owner' }
              : { environmentId, name: 'Computer', version: null, protocol },
        ),
      );
    },
  };
  return { store, platform, saved, requests };
}

describe('pairing an environment', () => {
  it('uses native device identity and authenticates the installation before saving', async () => {
    const { store, platform, saved, requests } = fixture();
    await Effect.runPromise(store.load());
    const remote = await runRequest(
      pairEnvironment(
        'http://computer.local:4738/pair#c=one-time&e=installation',
      ).pipe(
        Effect.provideService(AccessStore, store),
        Effect.provideService(AccessPlatform, platform),
      ),
      new AbortController().signal,
    );
    expect(requests).toEqual([
      {
        path: '/api/pair',
        authorization: null,
        body: JSON.stringify({ code: 'one-time', platform: 'iOS' }),
      },
      {
        path: '/api/environment',
        authorization: 'Bearer paired-credential',
        body: undefined,
      },
      {
        path: '/api/session',
        authorization: 'Bearer paired-credential',
        body: undefined,
      },
    ]);
    expect(saved).toEqual([[remote]]);
    expect(remote).toEqual({
      environmentId: 'installation',
      address: 'http://computer.local:4738',
      name: 'Computer',
      credential: 'paired-credential',
      deviceId: 'device',
    });
  });

  it.each([
    {
      environmentId: 'another-installation',
      protocol: ENVIRONMENT_PROTOCOL,
      message: 'Another Porcelain',
    },
    {
      environmentId: 'installation',
      protocol: ENVIRONMENT_PROTOCOL + 1,
      message: 'version',
    },
    {
      environmentId: 'installation',
      protocol: ENVIRONMENT_PROTOCOL - 1,
      message: 'version',
    },
  ])(
    'does not save an incompatible or different installation $environmentId/$protocol',
    async ({ environmentId, protocol, message }) => {
      const { store, platform, saved } = fixture(environmentId, protocol);
      await Effect.runPromise(store.load());
      await expect(
        runRequest(
          pairEnvironment(
            'http://computer.local:4738/pair#c=code&e=installation',
          ).pipe(
            Effect.provideService(AccessStore, store),
            Effect.provideService(AccessPlatform, platform),
          ),
          new AbortController().signal,
        ),
      ).rejects.toThrow(message);
      expect(saved).toEqual([]);
      expect(store.state.value.remotes).toEqual([]);
    },
  );

  it('does not save a cancelled pairing even when the transport completes', async () => {
    const { store, platform, saved } = fixture();
    await Effect.runPromise(store.load());
    const controller = new AbortController();
    const cancellingPlatform: AccessPlatformValue = {
      ...platform,
      send: (url, init) => {
        if (url.pathname === '/api/environment') controller.abort();
        return platform.send(url, init);
      },
    };
    await expect(
      runRequest(
        pairEnvironment(
          'http://computer.local:4738/pair#c=code&e=installation',
        ).pipe(
          Effect.provideService(AccessStore, store),
          Effect.provideService(AccessPlatform, cancellingPlatform),
        ),
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(saved).toEqual([]);
  });

  it('refuses an incomplete link without making a request', async () => {
    const { store, platform, saved, requests } = fixture();
    await Effect.runPromise(store.load());
    await expect(
      runRequest(
        pairEnvironment('http://computer.local:4738/pair').pipe(
          Effect.provideService(AccessStore, store),
          Effect.provideService(AccessPlatform, platform),
        ),
        new AbortController().signal,
      ),
    ).rejects.toThrow('whole link');
    expect(requests).toEqual([]);
    expect(saved).toEqual([]);
  });
});
