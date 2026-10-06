import { Clock, Effect, Fiber, Layer, Option, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import { it } from '@effect/vitest';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { afterEach, expect } from 'vitest';
import {
  createWorktreeConnection,
  type RuntimeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readRemoteAccess, readServiceUpdate } from './share.ts';
import { setRemoteAccess, startServiceUpdate } from '@porcelain/client/access';

const scopes = new Set<{
  connection: RuntimeConnection;
  registry: AtomRegistry.AtomRegistry;
}>();
afterEach(async () => {
  for (const { connection, registry } of scopes) {
    registry.dispose();
    await connection.close();
  }
  scopes.clear();
});
function fixture(transport: Transport) {
  const { connection } = createWorktreeConnection(
    {
      environmentId: 'environment',
      transport,
      timeoutMs: 10_000,
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  scopes.add({ connection, registry });
  return { connection, registry };
}
const off = { enabled: false, status: { kind: 'off' as const } };
const remote = {
  routes: { lan: off, tailnet: off, cloudflare: off },
  serviceUrl: 'http://127.0.0.1:4173',
};
const offered = {
  managed: true,
  version: '1.0.0',
  latest: '1.1.0',
  available: true,
  running: false,
  last: null,
  canUpdate: true,
};
const running = {
  ...offered,
  running: true,
  last: { from: '1.0.0', target: '1.1.0', stage: 'downloading', reason: null },
};
const updated = {
  ...offered,
  version: '1.1.0',
  available: false,
  last: { ...running.last, stage: 'updated' },
};

it('treats a remotely managed sharing configuration as unavailable here, while preserving other HTTP failures', async () => {
  const denied = fixture(() =>
    Promise.resolve(new Response(null, { status: 403 })),
  );
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        denied.registry,
        readRemoteAccess(denied.connection),
      ),
    ),
  ).toBeNull();
  const failed = fixture(() =>
    Promise.resolve(new Response(null, { status: 503 })),
  );
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        failed.registry,
        readRemoteAccess(failed.connection),
      ),
    ),
  ).rejects.toMatchObject({ status: 503 });
});

it.effect('does not poll a settled sharing configuration', () =>
  Effect.gen(function* () {
    const paths: string[] = [];
    const { connection, registry } = fixture((path) => {
      paths.push(path);
      return Promise.resolve(Response.json(remote));
    });
    connection.atoms.addGlobalLayer(
      Layer.succeed(Clock.Clock, yield* Clock.Clock),
    );
    const atom = readRemoteAccess(connection);
    registry.mount(atom);
    expect(yield* AtomRegistry.getResult(registry, atom)).toEqual(remote);
    yield* TestClock.adjust(3000);
    expect(paths).toEqual(['/api/remote-access']);
  }),
);

it.effect(
  'keeps polling an in-progress service update after a failed read, retains its progress, and stops when it settles',
  () =>
    Effect.gen(function* () {
      let reads = 0;
      const { connection, registry } = fixture(() => {
        reads += 1;
        return Promise.resolve(
          reads === 2
            ? new Response(null, { status: 503 })
            : Response.json(reads === 1 ? running : updated),
        );
      });
      connection.atoms.addGlobalLayer(
        Layer.succeed(Clock.Clock, yield* Clock.Clock),
      );
      const atom = readServiceUpdate(connection);
      registry.mount(atom);
      yield* AtomRegistry.getResult(registry, atom);
      yield* TestClock.adjust(1000);
      const failed = registry.get(atom);
      expect(AsyncResult.isFailure(failed)).toBe(true);
      expect(Option.getOrUndefined(AsyncResult.value(failed))).toMatchObject({
        running: true,
        last: { stage: 'downloading' },
      });
      yield* TestClock.adjust(1000);
      expect(
        Option.getOrUndefined(AsyncResult.value(registry.get(atom))),
      ).toMatchObject({
        running: false,
        version: '1.1.0',
        last: { stage: 'updated' },
      });
      yield* TestClock.adjust(3000);
      expect(reads).toBe(3);
    }),
);

it.effect(
  'never overlaps polling reads, and unmounting cancels the active request',
  () =>
    Effect.gen(function* () {
      let reads = 0;
      let activeSignal: AbortSignal | null | undefined;
      const { connection, registry } = fixture((_path, init) => {
        reads += 1;
        if (reads === 1) return Promise.resolve(Response.json(running));
        activeSignal = init?.signal;
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          ),
        );
      });
      connection.atoms.addGlobalLayer(
        Layer.succeed(Clock.Clock, yield* Clock.Clock),
      );
      const atom = readServiceUpdate(connection);
      const unmount = registry.mount(atom);
      yield* AtomRegistry.getResult(registry, atom);
      yield* TestClock.adjust(4000);
      expect(reads).toBe(2);
      expect(activeSignal?.aborted).toBe(false);
      unmount();
      yield* TestClock.adjust(0);
      expect(activeSignal?.aborted).toBe(true);
      yield* TestClock.adjust(3000);
      expect(reads).toBe(2);
    }),
);

it('publishes only the confirmed sharing reply while the subsequent read is still pending', async () => {
  let reads = 0;
  let releaseRead: ((answer: Response) => void) | undefined;
  const confirmed = { ...remote, tailnetHostname: 'owner.tail123.ts.net' };
  const { connection, registry } = fixture((_path, init) => {
    if (init?.method === 'PATCH')
      return Promise.resolve(Response.json(confirmed));
    reads += 1;
    if (reads === 1) return Promise.resolve(Response.json(remote));
    return new Promise((resolve) => {
      releaseRead = resolve;
    });
  });
  const atom = readRemoteAccess(connection);
  registry.mount(atom);
  await Effect.runPromise(AtomRegistry.getResult(registry, atom));
  const command = setRemoteAccess(connection);
  registry.mount(command);
  registry.set(command, { tailnetHostname: 'OWNER.TAIL123.TS.NET' });
  await Effect.runPromise(
    AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
  );
  expect(Option.getOrUndefined(AsyncResult.value(registry.get(atom)))).toEqual(
    confirmed,
  );
  expect(reads).toBe(2);
  releaseRead?.(Response.json(confirmed));
  await Effect.runPromise(
    AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
  );
});

it('a rejected update request leaves the confirmed offer intact and rechecks it', async () => {
  const requests: string[] = [];
  const { connection, registry } = fixture((_path, init) => {
    requests.push(init?.method ?? 'GET');
    return Promise.resolve(
      init?.method === 'POST'
        ? new Response(null, { status: 409 })
        : Response.json(offered),
    );
  });
  const atom = readServiceUpdate(connection);
  registry.mount(atom);
  await Effect.runPromise(AtomRegistry.getResult(registry, atom));
  const command = startServiceUpdate(connection);
  registry.mount(command);
  registry.set(command, '1.1.0');
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  await Effect.runPromise(
    AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
  );
  expect(
    Option.getOrUndefined(AsyncResult.value(registry.get(atom))),
  ).toMatchObject({ running: false, available: true, version: '1.0.0' });
  expect(requests).toEqual(['GET', 'POST', 'GET']);
});

it.effect(
  'an accepted update survives a failed first restart read and reaches the confirmed new version',
  () =>
    Effect.gen(function* () {
      let reads = 0;
      const { connection, registry } = fixture((_path, init) => {
        if (init?.method === 'POST')
          return Promise.resolve(Response.json(running, { status: 202 }));
        reads += 1;
        return Promise.resolve(
          reads === 2
            ? new Response(null, { status: 503 })
            : Response.json(reads === 1 ? offered : updated),
        );
      });
      connection.atoms.addGlobalLayer(
        Layer.succeed(Clock.Clock, yield* Clock.Clock),
      );
      const state = readServiceUpdate(connection);
      registry.mount(state);
      yield* AtomRegistry.getResult(registry, state);
      const command = startServiceUpdate(connection);
      registry.mount(command);
      const failure = yield* Effect.forkChild(
        AtomRegistry.toStream(registry, state).pipe(
          Stream.filter(AsyncResult.isFailure),
          Stream.take(1),
          Stream.runHead,
        ),
      );
      registry.set(command, '1.1.0');
      yield* AtomRegistry.getResult(registry, command, {
        suspendOnWaiting: true,
      });
      const disconnected = Option.getOrThrow(yield* Fiber.join(failure));
      expect(AsyncResult.isFailure(disconnected)).toBe(true);
      expect(
        Option.getOrUndefined(AsyncResult.value(disconnected)),
      ).toMatchObject({
        running: true,
        last: { target: '1.1.0', stage: 'downloading' },
      });
      yield* TestClock.adjust(1000);
      expect(yield* AtomRegistry.getResult(registry, state)).toMatchObject({
        running: false,
        version: '1.1.0',
        last: { stage: 'updated' },
      });
      expect(reads).toBe(3);
    }),
);
