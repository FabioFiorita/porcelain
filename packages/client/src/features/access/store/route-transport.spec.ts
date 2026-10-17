import { expect, it } from 'vitest';
import { Effect, Redacted } from 'effect';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { createRouteTransport } from './route-transport.ts';
import type { AccessPlatformValue } from '../ports/access-platform.ts';

const remote = {
  environmentId: 'computer',
  name: 'Development server',
  address: 'http://192.168.1.2:4738',
  credential: Redacted.make('lan-secret'),
  deviceId: '11111111-1111-4111-8111-111111111111',
  alternateRoutes: [
    {
      address: 'https://development.example.ts.net',
      credential: Redacted.make('tailnet-secret'),
      deviceId: '22222222-2222-4222-8222-222222222222',
    },
  ],
};
const descriptor = {
  environmentId: 'computer',
  name: 'Development server',
  version: '1.0.0',
  protocol: ENVIRONMENT_PROTOCOL,
};
function fixture() {
  let lan: 'online' | 'offline' | 'other' | 'revoked' = 'online';
  const calls: {
    host: string;
    path: string;
    authorization: string | null;
    method: string;
  }[] = [];
  let failWrite = false;
  const send: AccessPlatformValue['send'] = async (url, init) => {
    calls.push({
      host: url.hostname,
      path: url.pathname,
      authorization: new Headers(init?.headers).get('authorization'),
      method: init?.method ?? 'GET',
    });
    if (url.hostname === '192.168.1.2' && lan === 'offline')
      throw new TypeError('LAN unavailable');
    if (url.pathname === '/api/health')
      return Response.json({
        status: 'ok',
        environmentId:
          lan === 'other' && url.hostname === '192.168.1.2'
            ? 'another-computer'
            : 'computer',
      });
    if (url.pathname === '/api/environment')
      return Response.json({
        ...descriptor,
        ...(lan === 'other' && url.hostname === '192.168.1.2'
          ? { environmentId: 'another-computer' }
          : {}),
      });
    if (url.pathname === '/api/session')
      return lan === 'revoked' && url.hostname === '192.168.1.2'
        ? new Response(null, { status: 401 })
        : Response.json({
            kind: 'device',
            trusted: false,
            deviceId:
              url.hostname === '192.168.1.2'
                ? '11111111-1111-4111-8111-111111111111'
                : '22222222-2222-4222-8222-222222222222',
          });
    if (failWrite && init?.method === 'POST') {
      lan = 'offline';
      throw new TypeError('Acknowledgement lost');
    }
    return Response.json({ host: url.hostname });
  };
  const routing = createRouteTransport(remote, send);
  return {
    routing,
    send,
    calls,
    setLan(value: typeof lan) {
      lan = value;
    },
    failWrites() {
      failWrite = true;
    },
  };
}

it('falls back to Tailscale with its own credential and keeps one active route', async () => {
  const subject = fixture();
  subject.setLan('offline');
  expect(
    await (await subject.routing.transport('/api/inventory')).json(),
  ).toEqual({ host: 'development.example.ts.net' });
  expect(subject.routing.active.value?.address).toBe(
    'https://development.example.ts.net',
  );
  expect(
    subject.calls
      .filter((call) => call.path === '/api/health')
      .every((call) => call.authorization === null),
  ).toBe(true);
  expect(
    subject.calls
      .filter((call) => call.path !== '/api/health')
      .map((call) => call.authorization),
  ).toEqual([
    'Bearer tailnet-secret',
    'Bearer tailnet-secret',
    'Bearer tailnet-secret',
  ]);
  subject.setLan('online');
  await subject.routing.transport('/api/inventory');
  expect(subject.calls.at(-1)?.host).toBe('development.example.ts.net');
  await Effect.runPromise(subject.routing.select(true));
  expect(subject.routing.active.value?.address).toBe(remote.address);
});

it('tries another route when a read fails but the preferred health and session still answer', async () => {
  const subject = fixture();
  const reads: string[] = [];
  const routing = createRouteTransport(remote, (url, init) => {
    if (url.pathname === '/api/inventory') {
      reads.push(url.hostname);
      if (url.hostname === '192.168.1.2')
        return Promise.reject(new TypeError('Read connection reset'));
    }
    return subject.send(url, init);
  });
  expect(await (await routing.transport('/api/inventory')).json()).toEqual({
    host: 'development.example.ts.net',
  });
  expect(reads).toEqual(['192.168.1.2', 'development.example.ts.net']);
});

it('preserves a healthy Tailscale route when its caller cancels a read', async () => {
  const subject = fixture();
  subject.setLan('offline');
  const started = Promise.withResolvers<void>();
  let hold = true;
  const routing = createRouteTransport(remote, (url, init) => {
    if (hold && url.pathname === '/api/inventory') {
      started.resolve();
      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener(
          'abort',
          () => reject(init?.signal?.reason),
          { once: true },
        ),
      );
    }
    return subject.send(url, init);
  });
  await Effect.runPromise(routing.select());
  subject.setLan('online');
  const controller = new AbortController();
  const pending = routing.transport('/api/inventory', {
    signal: controller.signal,
  });
  await started.promise;
  controller.abort();
  await expect(pending).rejects.toBeDefined();
  expect(routing.active.value?.address).toBe(
    'https://development.example.ts.net',
  );
  hold = false;
  await routing.transport('/api/inventory');
  expect(routing.active.value?.address).toBe(
    'https://development.example.ts.net',
  );
});

it('keeps a mixed revoked and unreachable set retryable until the offline route recovers', async () => {
  const subject = fixture();
  subject.setLan('revoked');
  let available = false;
  const routing = createRouteTransport(remote, (url, init) =>
    !available && url.hostname === 'development.example.ts.net'
      ? Promise.reject(new TypeError('VPN unavailable'))
      : subject.send(url, init),
  );
  await expect(Effect.runPromise(routing.select())).rejects.toBeInstanceOf(
    ConnectionError,
  );
  available = true;
  expect((await routing.transport('/api/inventory')).status).toBe(200);
  expect(routing.active.value?.address).toBe(
    'https://development.example.ts.net',
  );
});

it('reconsiders a failed route after the remaining routes were also unavailable', async () => {
  const subject = fixture();
  let readsAvailable = false;
  const routing = createRouteTransport(remote, (url, init) => {
    if (
      url.hostname === 'development.example.ts.net' ||
      (!readsAvailable && url.pathname === '/api/inventory')
    )
      return Promise.reject(new TypeError('Route unavailable'));
    return subject.send(url, init);
  });
  await expect(routing.transport('/api/inventory')).rejects.toBeDefined();
  readsAvailable = true;
  expect((await routing.transport('/api/inventory')).status).toBe(200);
  expect(routing.active.value?.address).toBe(remote.address);
});

it.each(['other', 'revoked'] as const)(
  'uses the authorized fallback when the LAN host is %s',
  async (state) => {
    const subject = fixture();
    subject.setLan(state);
    await subject.routing.transport('/api/inventory');
    expect(subject.routing.active.value?.address).toBe(
      'https://development.example.ts.net',
    );
    if (state === 'other')
      expect(
        subject.calls.filter((call) => call.host === '192.168.1.2'),
      ).toEqual([
        {
          host: '192.168.1.2',
          path: '/api/health',
          authorization: null,
          method: 'GET',
        },
      ]);
  },
);

it('never replays a write whose acknowledgement was lost', async () => {
  const subject = fixture();
  await subject.routing.transport('/api/inventory');
  subject.failWrites();
  await expect(
    subject.routing.transport('/api/comments', {
      method: 'POST',
      body: 'comment',
    }),
  ).rejects.toThrow('Acknowledgement lost');
  expect(subject.calls.filter((call) => call.method === 'POST')).toEqual([
    {
      host: '192.168.1.2',
      path: '/api/comments',
      authorization: 'Bearer lan-secret',
      method: 'POST',
    },
  ]);
  await subject.routing.transport('/api/inventory');
  expect(subject.routing.active.value?.address).toBe(
    'https://development.example.ts.net',
  );
});

it('cancels an unreachable preferred route before trying another route', async () => {
  const requested = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const controller = new AbortController();
  const calls: string[] = [];
  const routing = createRouteTransport(remote, (url, init) => {
    calls.push(url.origin);
    requested.resolve();
    return new Promise((_resolve, reject) =>
      init?.signal?.addEventListener(
        'abort',
        () => {
          aborted.resolve();
          reject(init?.signal?.reason);
        },
        { once: true },
      ),
    );
  });
  const pending = routing.transport('/api/inventory', {
    signal: controller.signal,
  });
  await requested.promise;
  controller.abort();
  await expect(pending).rejects.toBeDefined();
  await aborted.promise;
  expect(calls).toEqual(['http://192.168.1.2:4738']);
  expect(routing.active.value).toBeUndefined();
});

it('bounds an unresponsive LAN probe before using Tailscale', async () => {
  const aborted = Promise.withResolvers<void>();
  const routing = createRouteTransport(remote, (url, init) => {
    if (url.hostname === '192.168.1.2')
      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener(
          'abort',
          () => {
            aborted.resolve();
            reject(init?.signal?.reason);
          },
          { once: true },
        ),
      );
    return Promise.resolve(
      Response.json(
        url.pathname === '/api/health'
          ? { status: 'ok', environmentId: 'computer' }
          : url.pathname === '/api/environment'
            ? descriptor
            : { kind: 'owner' },
      ),
    );
  });
  await routing.transport('/api/inventory');
  await aborted.promise;
  expect(routing.active.value?.address).toBe(
    'https://development.example.ts.net',
  );
}, 10000);

it('retries a failed read once over the authorized fallback', async () => {
  const subject = fixture();
  await subject.routing.transport('/api/inventory');
  subject.setLan('offline');
  await expect(
    subject.routing
      .transport('/api/inventory')
      .then((response) => response.json()),
  ).resolves.toEqual({ host: 'development.example.ts.net' });
  expect(
    subject.calls
      .filter((call) => call.path === '/api/inventory')
      .map((call) => call.host),
  ).toEqual(['192.168.1.2', '192.168.1.2', 'development.example.ts.net']);
});

it('keeps a typed authorization failure when all route credentials are revoked', async () => {
  const routing = createRouteTransport(remote, (url) =>
    Promise.resolve(
      url.pathname === '/api/health'
        ? Response.json({ status: 'ok', environmentId: 'computer' })
        : url.pathname === '/api/environment'
          ? Response.json(descriptor)
          : new Response(null, { status: 401 }),
    ),
  );
  const result = await Effect.runPromise(routing.select().pipe(Effect.result));
  expect(result._tag).toBe('Failure');
  if (result._tag === 'Failure')
    expect(result.failure).toBeInstanceOf(RequestError);
});
