import { Crypto, Effect, Layer, ManagedRuntime } from 'effect';
import { expect, it } from 'vitest';
import {
  AccessSession,
  sessionConnectionsLayer,
  AccessStore,
  ConnectionFactory,
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
  credential: 'test-credential',
  deviceId: 'first-device',
};

function fixture(
  options: {
    readonly saved?: readonly Remote[];
    readonly release?: () => Effect.Effect<void>;
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
        liveUpdates: { connect: () => ({ subscribe: () => {} }) },
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
    sessionConnectionsLayer.pipe(
      Layer.provideMerge(
        AccessSession.layer.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              stores,
              FileDrafts.layer,
              Layer.succeed(ConnectionFactory, {
                local: (session) =>
                  open(
                    session.inventory.environmentId,
                    'https://local.example',
                  ),
                remote: (saved) => open(saved.environmentId, saved.address),
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
    expect(original?.request().signal.aborted).toBe(true);
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
    expect(opened[0]?.request().signal.aborted).toBe(true);
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

it('retains renamed remotes but replaces a changed device journal and releases forgotten connections', async () => {
  const { runtime, session, access, opened, closed } = fixture({
    saved: [remote],
  });
  const changed = () =>
    new Promise<void>((resolve) => {
      const unsubscribe = session.state.subscribe(() => {
        unsubscribe();
        resolve();
      });
    });
  try {
    const loaded = changed();
    await runtime.runPromise(access.load());
    await loaded;
    const original = session.state.value.remoteConnections[0]?.connection;
    const renamed = changed();
    await runtime.runPromise(access.save({ ...remote, name: 'Renamed' }));
    await renamed;
    expect(session.state.value.remoteConnections[0]?.connection).toBe(original);
    expect(opened).toHaveLength(1);
    const renewed = changed();
    await runtime.runPromise(
      access.save({ ...remote, deviceId: 'second-device' }),
    );
    await renewed;
    expect(opened).toHaveLength(2);
    expect(session.state.value.remoteConnections[0]?.connection).toBe(
      opened[1],
    );
    const forgotten = changed();
    await runtime.runPromise(access.forget(remote.environmentId));
    await forgotten;
    expect(session.state.value.remoteConnections).toEqual([]);
  } finally {
    await runtime.dispose();
  }
  expect(closed).toEqual(['remote:0', 'remote:1']);
  expect(
    opened.every((connection) => connection.request().signal.aborted),
  ).toBe(true);
});

it('releases every local and remote connection when the application scope closes', async () => {
  const { runtime, session, access, opened, closed } = fixture({
    saved: [remote],
  });
  const loaded = new Promise<void>((resolve) => {
    const unsubscribe = session.state.subscribe(({ remoteConnections }) => {
      if (remoteConnections.length !== 1) return;
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
  expect(closed).toEqual(['remote:0', 'environment:1']);
  expect(
    opened.map((connection) => connection.operations.state.value.closed),
  ).toEqual([true, true]);
  expect(
    opened.map((connection) => connection.request().signal.aborted),
  ).toEqual([true, true]);
});
