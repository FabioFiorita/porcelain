import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { runRequest } from '@porcelain/client/transport';
import { pairEnvironment } from './pairing.ts';
import {
  AccessStore,
  EnvironmentStorage,
  type AccessPlatform,
} from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';

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
  const platform: AccessPlatform = {
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
        platform,
        'http://computer.local:4738/pair#c=one-time&e=installation',
      ).pipe(Effect.provideService(AccessStore, store)),
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
            platform,
            'http://computer.local:4738/pair#c=code&e=installation',
          ).pipe(Effect.provideService(AccessStore, store)),
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
    const cancellingPlatform: AccessPlatform = {
      ...platform,
      send: (url, init) => {
        if (url.pathname === '/api/environment') controller.abort();
        return platform.send(url, init);
      },
    };
    await expect(
      runRequest(
        pairEnvironment(
          cancellingPlatform,
          'http://computer.local:4738/pair#c=code&e=installation',
        ).pipe(Effect.provideService(AccessStore, store)),
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
        pairEnvironment(platform, 'http://computer.local:4738/pair').pipe(
          Effect.provideService(AccessStore, store),
        ),
        new AbortController().signal,
      ),
    ).rejects.toThrow('whole link');
    expect(requests).toEqual([]);
    expect(saved).toEqual([]);
  });
});
