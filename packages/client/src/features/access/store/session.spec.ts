import { Redacted, Crypto, Effect, Layer, ManagedRuntime } from 'effect';
import { expect, it } from 'vitest';
import {
  AccessSession,
  remoteConnectionsLayer,
  AccessStore,
  ConnectionFactory,
  RemoteConnectionFactory,
  RemoteConnections,
  EnvironmentStorage,
  type EnvironmentConnection,
} from '@porcelain/client/access';
import type { BrowserSession, Remote } from '@porcelain/client/access/rules';
import { FileDrafts } from '@porcelain/client/files';
import { OperationStorage } from '@porcelain/client/git-actions';
import { openLiveConnection } from '@porcelain/client/live';

const browser: BrowserSession = {
  inventory: {
    environmentId: 'environment',
    environment: { name: 'Computer', custom: false },
    projects: [],
  },
  principal: { kind: 'owner' },
};
const remote: Remote = {
  environmentId: 'remote',
  name: 'Remote',
  address: 'https://remote.example',
  credential: Redacted.make('test-credential'),
  deviceId: 'first-device',
};

function fixture(
  options: {
    readonly saved?: readonly Remote[];
    readonly release?: () => Effect.Effect<void>;
    readonly acquire?: () => Effect.Effect<void>;
  } = {},
) {
  const opened: EnvironmentConnection[] = [];
  const closed: string[] = [];
  const open = (environmentId: string, address: string) => {
    const identity = `${environmentId}:${opened.length}`;
    const connection = openLiveConnection(
      {
        environmentId,
        address,
        transport: () => Promise.resolve(Response.json({})),
        timeoutMs: 1000,
        liveUpdates: { connect: () => Effect.succeed({ subscribe: () => {} }) },
      },
      Layer.merge(
        Layer.effect(
          Crypto.Crypto,
          Effect.acquireRelease(
            Effect.succeed(
              Crypto.make({
                randomBytes: (length) => new Uint8Array(length),
                digest: (_, bytes) => Effect.succeed(bytes),
              }),
            ),
            () =>
              Effect.gen(function* () {
                if (options.release) yield* options.release();
                closed.push(identity);
              }),
          ),
        ),
        Layer.succeed(OperationStorage, {
          read: () => Effect.succeed(null),
          write: () => Effect.void,
          clear: () => Effect.void,
        }),
      ),
      runtime.memoMap,
    );
    opened.push(connection);
    return connection;
  };
  const stores = AccessStore.layer.pipe(
    Layer.provide(
      Layer.succeed(EnvironmentStorage, {
        read: () => Effect.succeed([...(options.saved ?? [])]),
        write: () => Effect.void,
      }),
    ),
  );
  const runtime = ManagedRuntime.make(
    remoteConnectionsLayer.pipe(
      Layer.provideMerge(
        Layer.merge(AccessSession.layer, RemoteConnections.layer).pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              stores,
              FileDrafts.layer,
              Layer.succeed(ConnectionFactory, {
                local: (session) =>
                  Effect.acquireRelease(
                    Effect.sync(() =>
                      open(
                        session.inventory.environmentId,
                        'https://local.example',
                      ),
                    ),
                    (connection) => Effect.promise(() => connection.close()),
                  ).pipe(Effect.tap(() => options.acquire?.() ?? Effect.void)),
              }),
              Layer.succeed(RemoteConnectionFactory, {
                open: (saved) =>
                  Effect.acquireRelease(
                    Effect.sync(() => open(saved.environmentId, saved.address)),
                    (connection) => Effect.promise(() => connection.close()),
                  ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
  return {
    runtime,
    session: runtime.runSync(AccessSession),
    access: runtime.runSync(AccessStore),
    connections: runtime.runSync(RemoteConnections),
    opened,
    closed,
  };
}

it('rejects stale restores and pairing completions after another completion or disconnect', async () => {
  const { runtime, session, opened } = fixture();
  try {
    const restore = runtime.runSync(session.beginConnection(true));
    const pair = runtime.runSync(session.beginConnection());
    if (!restore || !pair)
      throw new Error('Initial connection attempts must be admitted');
    expect(await runtime.runPromise(pair(browser))).toBe(true);
    expect(await runtime.runPromise(restore(browser))).toBe(false);
    expect(opened).toHaveLength(1);
    expect(runtime.runSync(session.beginConnection(true))).toBeNull();
    const stale = runtime.runSync(session.beginConnection());
    if (!stale) throw new Error('Manual pairing must be admitted');
    await runtime.runPromise(session.clear());
    expect(await runtime.runPromise(stale(browser))).toBe(false);
    expect(session.state.value).toMatchObject({
      connection: null,
      generation: 2,
    });
    expect(opened).toHaveLength(1);
  } finally {
    await runtime.dispose();
  }
});

it('keeps one writer connection and releases it when the authenticated principal changes', async () => {
  const { runtime, session, opened, closed } = fixture();
  const complete = async (value: BrowserSession) => {
    const attempt = runtime.runSync(session.beginConnection());
    if (!attempt) throw new Error('Manual pairing must be admitted');
    return runtime.runPromise(attempt(value));
  };
  try {
    await complete(browser);
    const original = session.state.value.connection;
    await complete(browser);
    expect(session.state.value.connection).toBe(original);
    expect(opened).toHaveLength(1);
    await complete({
      ...browser,
      principal: { kind: 'device', deviceId: 'new-device' },
    });
    expect(opened).toHaveLength(2);
    expect(session.state.value.connection).toBe(opened[1]);
    expect(original?.isClosed()).toBe(true);
    expect(original?.operations.state.value.closed).toBe(true);
    expect(closed).toEqual(['environment:0']);
  } finally {
    await runtime.dispose();
  }
  expect(closed).toEqual(['environment:0', 'environment:1']);
});

it('invalidates a session immediately and waits for its platform release before finishing disconnect', async () => {
  const releasing = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const { runtime, session, opened, closed } = fixture({
    release: () =>
      Effect.promise(() => {
        releasing.resolve();
        return released.promise;
      }),
  });
  try {
    const complete = runtime.runSync(session.beginConnection());
    if (!complete) throw new Error('Manual pairing must be admitted');
    await runtime.runPromise(complete(browser));
    let finished = false;
    const clearing = runtime.runPromise(session.clear()).then(() => {
      finished = true;
    });
    await releasing.promise;
    expect(session.state.value.connection).toBeNull();
    expect(opened[0]?.isClosed()).toBe(true);
    expect(finished).toBe(false);
    expect(closed).toEqual([]);
    released.resolve();
    await clearing;
    expect(finished).toBe(true);
    expect(closed).toEqual(['environment:0']);
  } finally {
    released.resolve();
    await runtime.dispose();
  }
});

it.each([
  ['credential', { credential: Redacted.make('new-credential') }],
  ['address', { address: 'https://other.example' }],
  ['device', { deviceId: 'second-device' }],
])(
  'retains renamed remotes but replaces a changed %s and releases forgotten connections',
  async (_, changedIdentity) => {
    const { runtime, connections, access, opened, closed } = fixture({
      saved: [remote],
    });
    const changed = () =>
      new Promise<void>((resolve) => {
        const unsubscribe = connections.state.subscribe(() => {
          unsubscribe();
          resolve();
        });
      });
    try {
      const loaded = changed();
      await runtime.runPromise(access.load());
      await loaded;
      const original = connections.state.value[0]?.connection;
      const renamed = changed();
      await runtime.runPromise(access.save({ ...remote, name: 'Renamed' }));
      await renamed;
      expect(connections.state.value[0]?.connection).toBe(original);
      expect(opened).toHaveLength(1);
      const renewed = changed();
      await runtime.runPromise(access.save({ ...remote, ...changedIdentity }));
      await renewed;
      expect(opened).toHaveLength(2);
      expect(connections.state.value[0]?.connection).toBe(opened[1]);
      const forgotten = changed();
      await runtime.runPromise(access.forget(remote.environmentId));
      await forgotten;
      expect(connections.state.value).toEqual([]);
    } finally {
      await runtime.dispose();
    }
    expect(closed).toEqual(['remote:0', 'remote:1']);
    expect(opened.every((connection) => connection.isClosed())).toBe(true);
  },
);

it('releases every local and remote connection when the application scope closes', async () => {
  const { runtime, session, connections, access, opened, closed } = fixture({
    saved: [remote],
  });
  const loaded = new Promise<void>((resolve) => {
    const unsubscribe = connections.state.subscribe((remotes) => {
      if (remotes.length !== 1) return;
      unsubscribe();
      resolve();
    });
  });
  await runtime.runPromise(access.load());
  await loaded;
  const complete = runtime.runSync(session.beginConnection());
  if (!complete) throw new Error('Manual pairing must be admitted');
  await runtime.runPromise(complete(browser));
  await runtime.dispose();
  expect([...closed].sort()).toEqual(['environment:1', 'remote:0']);
  expect(
    opened.map((connection) => connection.operations.state.value.closed),
  ).toEqual([true, true]);
  expect(opened.map((connection) => connection.isClosed())).toEqual([
    true,
    true,
  ]);
});

it('releases a connection acquired after disconnect instead of publishing its stale result', async () => {
  const acquiring = Promise.withResolvers<void>();
  const acquired = Promise.withResolvers<void>();
  const { runtime, session, opened, closed } = fixture({
    acquire: () =>
      Effect.promise(() => {
        acquiring.resolve();
        return acquired.promise;
      }),
  });
  try {
    const complete = runtime.runSync(session.beginConnection());
    if (!complete) throw new Error('Manual pairing must be admitted');
    const completing = runtime.runPromise(complete(browser));
    await acquiring.promise;
    await runtime.runPromise(session.clear());
    acquired.resolve();
    expect(await completing).toBe(false);
    expect(session.state.value.connection).toBeNull();
    expect(closed).toEqual(['environment:0']);
    expect(opened[0]?.isClosed()).toBe(true);
  } finally {
    acquired.resolve();
    await runtime.dispose();
  }
});

it('serializes remote replacement and forgetting until the retired connection releases', async () => {
  const releasing = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const { runtime, connections, opened, closed } = fixture({
    release: () =>
      Effect.promise(() => {
        releasing.resolve();
        return released.promise;
      }),
  });
  try {
    await runtime.runPromise(connections.synchronize([remote]));
    const replacing = runtime.runPromise(
      connections.synchronize([
        { ...remote, credential: Redacted.make('new-credential') },
      ]),
    );
    await releasing.promise;
    const forgetting = runtime.runPromise(
      Effect.gen(function* () {
        started.resolve();
        yield* connections.synchronize([]);
      }),
    );
    await started.promise;
    expect(connections.state.value[0]?.connection).toBe(opened[1]);
    expect(opened).toHaveLength(2);
    expect(closed).toEqual([]);
    released.resolve();
    await Promise.all([replacing, forgetting]);
    expect(connections.state.value).toEqual([]);
    expect(closed).toEqual(['remote:0', 'remote:1']);
  } finally {
    released.resolve();
    await runtime.dispose();
  }
  expect(closed).toEqual(['remote:0', 'remote:1']);
});

it('keeps an application connection after a consuming screen scope releases', async () => {
  const { runtime, connections, opened, closed } = fixture();
  try {
    await runtime.runPromise(connections.synchronize([remote]));
    const consumerClosed: string[] = [];
    const borrowed = await runtime.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const pool = yield* RemoteConnections;
          yield* Effect.acquireRelease(
            Effect.sync(() => pool.state.subscribe(() => {})),
            (release) =>
              Effect.sync(() => {
                release();
                consumerClosed.push('screen');
              }),
          );
          return pool.state.value[0]?.connection;
        }),
      ),
    );
    expect(borrowed).toBe(opened[0]);
    expect(consumerClosed).toEqual(['screen']);
    expect(closed).toEqual([]);
    expect(connections.state.value[0]?.connection).toBe(opened[0]);
    expect(opened[0]?.isClosed()).toBe(false);
    expect(opened[0]?.operations.state.value.closed).toBe(false);
  } finally {
    await runtime.dispose();
  }
  expect(closed).toEqual(['remote:0']);
});
