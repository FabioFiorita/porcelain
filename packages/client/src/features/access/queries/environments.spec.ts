import { liveSessionState } from '../../live/store.ts';
import { afterEach, describe, expect } from 'vitest';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import type { AccessPlatformValue } from '../ports/access-platform.ts';
import { it } from '@effect/vitest';
import {
  Redacted,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Option,
  Clock,
  Layer,
  ManagedRuntime,
} from 'effect';
import { TestClock } from 'effect/testing';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import {
  readRemoteEnvironment,
  readRemoteStatus,
  readRemoteConnectionStatus,
  revalidateRemoteStatus,
  remoteStatusResult,
} from './environments.ts';
import { statusRuntime } from '../store/status.ts';
import type { RemoteAnswer } from '../rules/remotes.ts';
import type { Transport } from '@porcelain/client/transport';
const environment = {
  environmentId: 'saved-environment',
  name: 'Computer',
  version: '1.0.0',
  protocol: ENVIRONMENT_PROTOCOL,
};
async function status(
  transport: Transport,
  signal = new AbortController().signal,
) {
  return Effect.runPromise(
    readRemoteEnvironment(transport, environment.environmentId),
    { signal: signal },
  );
}

describe('environment status', () => {
  it.each([
    [200, 'described'],
    [401, 'unauthorized'],
    [503, 'unreachable'],
  ])('maps the authenticated read answering %s to %s', async (code, kind) => {
    const paths: string[] = [];
    const result = await status((path) => {
      paths.push(path);
      return Promise.resolve(
        path === '/api/environment'
          ? Response.json(environment)
          : code === 200
            ? Response.json({ kind: 'owner' })
            : new Response(null, { status: code }),
      );
    });
    expect(paths).toEqual(['/api/environment', '/api/session']);
    expect(result.kind).toBe(kind);
  });

  it.each([
    [
      'another environment',
      { ...environment, environmentId: 'another-environment' },
    ],
    [
      'a newer protocol',
      { ...environment, protocol: ENVIRONMENT_PROTOCOL + 1 },
    ],
    [
      'an older protocol',
      { ...environment, protocol: ENVIRONMENT_PROTOCOL - 1 },
    ],
  ])(
    'returns the descriptor of %s without an authenticated read',
    async (_, descriptor) => {
      const paths: string[] = [];
      expect(
        await status((path) => {
          paths.push(path);
          return Promise.resolve(Response.json(descriptor));
        }),
      ).toEqual({ kind: 'described', environment: descriptor });
      expect(paths).toEqual(['/api/environment']);
    },
  );

  it('answers unreachable when the authenticated read cannot be reached', async () => {
    expect(
      await status((path) =>
        path === '/api/environment'
          ? Promise.resolve(Response.json(environment))
          : Promise.reject(new TypeError('Network failed')),
      ),
    ).toEqual({ kind: 'unreachable' });
  });

  it.each([
    [200, 'unreachable'],
    [401, 'unauthorized'],
    [503, 'unreachable'],
  ])(
    'checks the session after a descriptor transport failure and maps %s to %s',
    async (code, kind) => {
      const paths: string[] = [];
      const answer = await status((path) => {
        paths.push(path);
        return path === '/api/environment'
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(
              code === 200
                ? Response.json({ kind: 'owner' })
                : new Response(null, { status: code }),
            );
      });
      expect(paths).toEqual(['/api/environment', '/api/session']);
      expect(answer).toEqual({ kind });
    },
  );

  it('stays unreachable when neither the descriptor nor its session can be reached', async () => {
    const paths: string[] = [];
    const answer = await status((path) => {
      paths.push(path);
      return Promise.reject(new TypeError('Network failed'));
    });
    expect(paths).toEqual(['/api/environment', '/api/session']);
    expect(answer).toEqual({ kind: 'unreachable' });
  });

  it('propagates cancellation during the authenticated read', async () => {
    const controller = new AbortController();
    await expect(
      status((path, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        if (path === '/api/environment')
          return Promise.resolve(Response.json(environment));
        controller.abort();
        return Promise.reject(controller.signal.reason);
      }, controller.signal),
    ).rejects.toThrow('All fibers interrupted without error');
  });
});

it.effect(
  'bounds a remote status read at five seconds and cancels its transport',
  () =>
    Effect.gen(function* () {
      let requestSignal: AbortSignal | undefined;
      const started = Deferred.makeUnsafe<void>();
      const result = yield* Effect.forkChild(
        readRemoteEnvironment((_path, init) => {
          requestSignal = init?.signal ?? undefined;
          Effect.runSync(Deferred.succeed(started, undefined));
          return new Promise<Response>((_resolve, reject) => {
            requestSignal?.addEventListener(
              'abort',
              () => reject(requestSignal?.reason),
              { once: true },
            );
          });
        }, environment.environmentId),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      yield* TestClock.adjust(4999);
      expect(requestSignal?.aborted).toBe(false);
      yield* TestClock.adjust(1);
      expect(yield* Fiber.join(result)).toEqual({ kind: 'unreachable' });
      expect(requestSignal?.aborted).toBe(true);
    }),
);

const remote = {
  environmentId: environment.environmentId,
  name: 'Computer',
  address: 'http://127.0.0.1:3000',
  credential: Redacted.make('original-credential'),
};
const registries = new Set<AtomRegistry.AtomRegistry>();
afterEach(() => {
  for (const registry of registries) registry.dispose();
  registries.clear();
  for (const runtime of testRuntimes.splice(0)) void runtime.dispose();
});
function registryFixture() {
  const registry = AtomRegistry.make();
  registries.add(registry);
  return registry;
}
function statusPlatform(
  send: AccessPlatformValue['send'],
): AccessPlatformValue {
  return {
    send: (url, init) =>
      url.pathname === '/api/health'
        ? Promise.resolve(
            Response.json({
              status: 'ok',
              environmentId: environment.environmentId,
            }),
          )
        : send(url, init),
    name: () => 'Test device',
  };
}

it('shares the authenticated status read between consumers of one saved identity', async () => {
  const paths: string[] = [];
  const platform = statusPlatform((address) => {
    paths.push(address.pathname);
    return Promise.resolve(
      Response.json(
        address.pathname === '/api/environment'
          ? environment
          : { kind: 'owner' },
      ),
    );
  });
  const registry = registryFixture();
  const first = readRemoteStatus(platform, remote);
  const second = readRemoteStatus(platform, { ...remote });
  const result = await Effect.runPromise(
    Effect.all(
      [
        AtomRegistry.getResult(registry, first),
        AtomRegistry.getResult(registry, second),
      ],
      { concurrency: 'unbounded' },
    ),
  );
  expect(result).toEqual([
    { kind: 'described', environment },
    { kind: 'described', environment },
  ]);
  expect(paths).toEqual(['/api/environment', '/api/session']);
});

it('keeps a re-paired identity separate from the old authorization failure', async () => {
  const credentials: string[] = [];
  const platform = statusPlatform((address, init) => {
    const authorization = new Headers(init?.headers).get('authorization') ?? '';
    credentials.push(authorization);
    return Promise.resolve(
      address.pathname === '/api/environment'
        ? Response.json(environment)
        : authorization.endsWith('replacement-credential')
          ? Response.json({ kind: 'owner' })
          : new Response(null, { status: 401 }),
    );
  });
  const registry = registryFixture();
  const old = await Effect.runPromise(
    AtomRegistry.getResult(registry, readRemoteStatus(platform, remote)),
  );
  const repaired = await Effect.runPromise(
    AtomRegistry.getResult(
      registry,
      readRemoteStatus(platform, {
        ...remote,
        credential: Redacted.make('replacement-credential'),
      }),
    ),
  );
  expect(old).toEqual({ kind: 'unauthorized' });
  expect(repaired).toEqual({ kind: 'described', environment });
  expect(credentials).toEqual([
    'Bearer original-credential',
    'Bearer original-credential',
    'Bearer replacement-credential',
    'Bearer replacement-credential',
  ]);
});

it('cancels a pending status transport when its registry is disposed', async () => {
  const requested = Deferred.makeUnsafe<void>();
  const canceled = Deferred.makeUnsafe<void>();
  let signal: AbortSignal | null | undefined;
  const platform = statusPlatform((_address, init) => {
    signal = init?.signal;
    Effect.runSync(Deferred.succeed(requested, undefined));
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener(
        'abort',
        () => {
          Effect.runSync(Deferred.succeed(canceled, undefined));
          reject(signal?.reason);
        },
        { once: true },
      );
    });
  });
  const registry = registryFixture();
  registry.mount(readRemoteStatus(platform, remote));
  await Effect.runPromise(Deferred.await(requested));
  expect(signal?.aborted).toBe(false);
  registry.dispose();
  await Effect.runPromise(Deferred.await(canceled));
  expect(signal?.aborted).toBe(true);
});

it('classifies remote status results and prioritizes failure over retained success', () => {
  const online: RemoteAnswer = { kind: 'described', environment };
  const cases = [
    AsyncResult.initial<RemoteAnswer>(),
    AsyncResult.success<RemoteAnswer>(online),
    AsyncResult.success<RemoteAnswer>({ kind: 'unreachable' }),
    AsyncResult.success<RemoteAnswer>({ kind: 'unauthorized' }),
    AsyncResult.success<RemoteAnswer>({
      kind: 'described',
      environment: { ...environment, protocol: ENVIRONMENT_PROTOCOL - 1 },
    }),
    AsyncResult.success<RemoteAnswer>({
      kind: 'described',
      environment: { ...environment, environmentId: 'another' },
    }),
    AsyncResult.fromExitWithPrevious(
      Exit.fail('offline'),
      Option.some(AsyncResult.success(online)),
    ),
  ];
  expect(
    cases.map((result) => remoteStatusResult(remote, result).kind),
  ).toEqual([
    'checking',
    'online',
    'offline',
    'needs-pairing',
    'incompatible',
    'other-server',
    'offline',
  ]);
});

const testRuntimes: ManagedRuntime.ManagedRuntime<never, never>[] = [];

async function lifecycleFixture(
  initial: {
    answer?: typeof environment;
    hold?: Promise<void>;
    outage?: boolean;
  } = {},
) {
  const runtime = ManagedRuntime.make(TestClock.layer());
  testRuntimes.push(runtime);
  const clock = await runtime.runPromise(Clock.Clock);
  let active = true;
  const listeners = new Set<() => void>();
  let answer = initial.answer ?? environment;
  let outage = initial.outage ?? false;
  let hold: Promise<void> | undefined = initial.hold;
  const requests: {
    path: string;
    authorization: string | null;
    signal: AbortSignal | null | undefined;
  }[] = [];
  const platform: AccessPlatformValue = {
    name: () => 'Lifecycle test',
    statusActivity: {
      isActive: () => active,
      subscribe: (changed) => {
        listeners.add(changed);
        return () => {
          listeners.delete(changed);
        };
      },
    },
    send: async (url, init) => {
      requests.push({
        path: url.pathname,
        authorization: new Headers(init?.headers).get('authorization'),
        signal: init?.signal,
      });
      const descriptor =
        url.port === '3001'
          ? {
              ...environment,
              environmentId: 'other-environment',
              name: 'Other computer',
            }
          : answer;
      if (hold) await hold;
      if (outage) throw new TypeError('Host unavailable');
      return Response.json(
        url.pathname === '/api/health'
          ? { status: 'ok', environmentId: descriptor.environmentId }
          : url.pathname === '/api/environment'
            ? descriptor
            : { kind: 'owner' },
      );
    },
  };
  const registry = registryFixture();
  statusRuntime(platform).addGlobalLayer(Layer.succeed(Clock.Clock, clock));
  const atom = readRemoteStatus(platform, remote);
  const stop = registry.mount(atom);
  return {
    platform,
    registry,
    atom,
    requests,
    listeners,
    stop,
    status: () => remoteStatusResult(remote, registry.get(atom)),
    activity: (value: boolean) => {
      active = value;
      for (const changed of listeners) changed();
    },
    answer: (value: typeof environment) => {
      answer = value;
    },
    outage: (value: boolean) => {
      outage = value;
    },
    hold: (value: Promise<void> | undefined) => {
      hold = value;
    },
    advance: (ms: number) => runtime.runPromise(TestClock.adjust(ms)),
    flush: () => runtime.runPromise(TestClock.adjust(0)),
  };
}

it('recovers from an outage on the next automatic probe and distinguishes reconnecting', async () => {
  const subject = await lifecycleFixture({ outage: true });
  await subject.flush();
  expect(subject.status()).toEqual({ kind: 'offline' });
  let release = () => {};
  subject.hold(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  subject.outage(false);
  await subject.advance(30_000);
  expect(subject.status()).toEqual({ kind: 'reconnecting' });
  release();
  await subject.flush();
  expect(subject.status()).toEqual({
    kind: 'online',
    name: 'Computer',
    version: '1.0.0',
  });
});

it('pauses in background and revalidates on foreground without overlapping event bursts', async () => {
  const subject = await lifecycleFixture();
  await subject.flush();
  subject.activity(false);
  await subject.flush();
  await subject.advance(90_000);
  expect(subject.requests).toHaveLength(3);
  subject.answer({ ...environment, name: 'Foreground name' });
  let release = () => {};
  subject.hold(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  subject.activity(true);
  await subject.flush();
  subject.activity(true);
  revalidateRemoteStatus(subject.platform, remote);
  await subject.flush();
  expect(subject.requests).toHaveLength(4);
  release();
  await subject.flush();
  expect(subject.status()).toEqual({
    kind: 'online',
    name: 'Foreground name',
    version: '1.0.0',
  });
  expect(subject.requests).toHaveLength(6);
});

it('recovers after identity mismatch without reading the substituted host session', async () => {
  const subject = await lifecycleFixture({
    answer: { ...environment, environmentId: 'substituted-host' },
  });
  await subject.flush();
  expect(subject.status()).toEqual({ kind: 'other-server' });
  await subject.advance(30_000);
  expect(
    subject.requests.map(({ path, authorization }) => ({
      path,
      authorization,
    })),
  ).toEqual([
    { path: '/api/health', authorization: null },
    { path: '/api/health', authorization: null },
  ]);
  subject.answer(environment);
  await subject.advance(30_000);
  expect(subject.status()).toEqual({
    kind: 'online',
    name: 'Computer',
    version: '1.0.0',
  });
});

it('switches environments without displaying a late answer from the previous selection', async () => {
  const { subject, release } = await pendingLifecycle();
  await subject.flush();
  const other = {
    ...remote,
    environmentId: 'other-environment',
    address: 'http://127.0.0.1:3001',
  };
  const otherAtom = readRemoteStatus(subject.platform, other);
  subject.registry.mount(otherAtom);
  expect(remoteStatusResult(other, subject.registry.get(otherAtom))).toEqual({
    kind: 'checking',
  });
  subject.stop();
  await subject.flush();
  subject.answer({
    ...environment,
    environmentId: other.environmentId,
    name: 'Other computer',
  });
  release();
  await subject.flush();
  expect(subject.requests[0]?.signal?.aborted).toBe(true);
  expect(remoteStatusResult(other, subject.registry.get(otherAtom))).toEqual({
    kind: 'online',
    name: 'Other computer',
    version: '1.0.0',
  });
});

it('cancels background requests and releases every activity subscription when unmounted', async () => {
  const subject = await lifecycleFixture({ hold: new Promise<void>(() => {}) });
  await subject.flush();
  subject.activity(false);
  await subject.flush();
  expect(subject.requests[0]?.signal?.aborted).toBe(true);
  subject.stop();
  await subject.flush();
  expect(subject.listeners.size).toBe(0);
  subject.activity(true);
  await subject.advance(60_000);
  expect(subject.requests).toHaveLength(1);
});

it('does not lose foreground recovery when background and foreground arrive during a pending probe', async () => {
  const { subject, release } = await pendingLifecycle();
  await subject.flush();
  subject.activity(false);
  subject.activity(true);
  await subject.flush();
  expect(subject.requests[0]?.signal?.aborted).toBe(true);
  expect(subject.requests).toHaveLength(2);
  release();
  await subject.flush();
  expect(subject.status().kind).toBe('online');
});

async function pendingLifecycle() {
  const held = Promise.withResolvers<void>();
  return {
    subject: await lifecycleFixture({ hold: held.promise }),
    release: () => held.resolve(),
  };
}

it('uses the live session as connection truth when independent HTTP probes fail, and exposes recovery and revocation', async () => {
  const subject = await lifecycleFixture({ outage: true });
  const state = liveSessionState();
  state.set('connected');
  const atom = readRemoteConnectionStatus(subject.platform, remote, {
    liveUpdates: {
      state,
      connect: () => Effect.die('Reading status must not own a live session'),
    },
  });
  const stop = subject.registry.mount(atom);
  await subject.flush();
  expect(subject.status()).toEqual({ kind: 'offline' });
  expect(subject.registry.get(atom)).toEqual({
    kind: 'online',
    name: 'Computer',
  });
  state.set('reconnecting');
  expect(subject.registry.get(atom)).toEqual({ kind: 'reconnecting' });
  state.set('unauthorized');
  expect(subject.registry.get(atom)).toEqual({ kind: 'needs-pairing' });
  state.set('idle');
  expect(subject.registry.get(atom)).toEqual({ kind: 'offline' });
  stop();
  subject.stop();
});
