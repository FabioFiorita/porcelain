import { operationStoreLayer } from '@porcelain/client/git-actions';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { readFilePreferences } from '@porcelain/client/projects';
import { readTextFile } from '@porcelain/client/files';
import { Crypto, Equal, Layer, ManagedRuntime, type Context } from 'effect';
import { afterEach } from 'vitest';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import {
  createWorktreeConnection,
  queryKeys,
  type Transport,
} from '@porcelain/client/transport';
import {
  OperationStore,
  OperationStorage,
  operationKey,
} from '@porcelain/client/git-actions';
import type { RunGitActionRequest } from '@porcelain/contracts/git-actions';
import type { LiveSubscription, LiveUpdatePort } from '../ports/live-update.ts';
import { liveQueries } from './live-queries.ts';

const environmentId = '44444444-4444-4444-8444-444444444444';
const projectId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const request: RunGitActionRequest = {
  requestId,
  input: {
    action: 'fetch',
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
  },
  expected: {
    headOid: undefined,
    branch: undefined,
    inProgress: undefined,
    mergeHeadOid: undefined,
  },
};

async function setup(
  transport?: Transport,
  onSubscription?: (subscription: LiveSubscription) => void,
) {
  const { store: operations } = operationStoreFixture();
  const lifetime = createWorktreeConnection(
    {
      environmentId,
      transport:
        transport ??
        (() =>
          Promise.resolve(
            Response.json({
              environmentId,
              environment: { name: 'Live', custom: false },
              projects: [],
            }),
          )),
      timeoutMs: 1000,
    },
    undefined,
    Layer.merge(
      Layer.succeed(OperationStore, operations),
      Layer.succeed(
        Crypto.Crypto,
        Crypto.make({
          randomBytes: (size) => new Uint8Array(size),
          digest: (_, bytes) => Effect.succeed(bytes),
        }),
      ),
    ),
  );
  const registry = AtomRegistry.make();
  const sent: LiveSubscription[] = [];
  const subscribed = Promise.withResolvers<void>();
  let live: Parameters<LiveUpdatePort['connect']>[0] | undefined;
  const liveUpdates: LiveUpdatePort = {
    connect: (options) => {
      live = options;
      return {
        subscribe: (value) => {
          sent.push(value);
          onSubscription?.(value);
          subscribed.resolve();
        },
      };
    },
  };
  const connection = Equal.byReference({
    ...lifetime.connection,
    controller: lifetime.controller,
    operations,
    liveUpdates,
  });
  const owner = liveQueries({ connection, onUnauthorized: () => {} });
  const unmount = registry.mount(owner);
  const close = async () => {
    const stopped = Promise.withResolvers<void>();
    if (!live || live.signal.aborted) stopped.resolve();
    else
      live.signal.addEventListener('abort', () => stopped.resolve(), {
        once: true,
      });
    unmount();
    await stopped.promise;
  };
  await Effect.runPromise(AtomRegistry.getResult(registry, owner));
  return {
    ...lifetime,
    connection,
    registry,
    operations,
    sent,
    subscribed: subscribed.promise,
    live: () => live,
    close,
    cleanup: async () => {
      await close();
      registry.dispose();
      await lifetime.close();
    },
  };
}

it('keeps pending operations subscribed within the server limit and retains their active paths', async () => {
  const capped = Promise.withResolvers<void>();
  const subject = await setup(
    (path) => {
      if (path.endsWith('/inventory'))
        return Promise.resolve(
          Response.json({
            environmentId,
            environment: { name: 'Live', custom: false },
            projects: [],
          }),
        );
      const url = new URL(path, 'http://localhost');
      return Promise.resolve(
        Response.json({
          worktreeId: path.split('/')[3],
          path: url.searchParams.get('path'),
          encoding: 'utf-8',
          byteLength: 4,
          text: 'Read',
        }),
      );
    },
    (subscription) => {
      if (
        subscription.worktrees.length === 32 &&
        subscription.worktrees[0]?.paths.includes('file-32.ts')
      )
        capped.resolve();
    },
  );
  const unsubscribe: (() => void)[] = [];
  const pendingTree = '00000000000000000000000000000020';
  try {
    for (let index = 0; index < 33; index += 1) {
      const worktreeId = index.toString(16).padStart(32, '0');
      const query = readTextFile({
        connection: subject.connection,
        scope: { projectId, worktreeId },
        path: `file-${index}.ts`,
      });
      unsubscribe.push(subject.registry.mount(query));
    }
    const scope = { projectId, worktreeId: pendingTree };
    await Effect.runPromise(
      subject.operations.set(operationKey(scope, 'fetch'), {
        ...scope,
        requestId,
        request,
      }),
    );
    await capped.promise;
    expect(subject.sent.at(-1)?.worktrees).toHaveLength(32);
    expect(subject.sent.at(-1)?.worktrees[0]).toEqual({
      ...scope,
      paths: ['file-32.ts'],
    });
    expect(
      subject.sent
        .at(-1)
        ?.worktrees.some(
          (entry) => entry.worktreeId === '0000000000000000000000000000001f',
        ),
    ).toBe(false);
  } finally {
    for (const stop of unsubscribe) stop();
    await subject.cleanup();
  }
});

it('releases queued subscription work when its native scope closes', async () => {
  const subject = await setup();
  try {
    await subject.close();
    const before = [...subject.sent];
    await Effect.runPromise(
      subject.operations.set(
        operationKey(
          { projectId, worktreeId: '0123456789abcdef0123456789abcdef' },
          'fetch',
        ),
        {
          projectId,
          worktreeId: '0123456789abcdef0123456789abcdef',
          requestId,
          request,
        },
      ),
    );
    expect(subject.live()?.signal.aborted).toBe(true);
    expect(subject.sent).toEqual(before);
  } finally {
    await subject.cleanup();
  }
});

it('ignores late notices and reconnect callbacks after closing the live session', async () => {
  const subject = await setup();
  let refreshes = 0;
  const unregister = subject.connection.runtime
    .runSync(Reactivity.Reactivity)
    .registerUnsafe([queryKeys.inventory(environmentId)], () => {
      refreshes += 1;
    });
  try {
    await subject.close();
    const before = [...subject.sent];
    subject.live()?.onNotice({ type: 'inventory' });
    subject.live()?.onReconnect();
    await Promise.resolve();
    expect(refreshes).toBe(0);
    expect(subject.sent).toEqual(before);
  } finally {
    unregister();
    await subject.cleanup();
  }
});

it('a file notice invalidates only the connected environment', async () => {
  const subject = await setup();
  let inventoryRefreshes = 0;
  const unregister = subject.connection.runtime
    .runSync(Reactivity.Reactivity)
    .registerUnsafe([queryKeys.inventory(environmentId)], () => {
      inventoryRefreshes += 1;
    });
  const scope = { projectId, worktreeId: '00000000000000000000000000000001' };
  const current = queryKeys.reviewSurface(environmentId, scope, ['text']);
  const other = queryKeys.reviewSurface('other', scope, ['text']);
  let currentRefreshes = 0;
  let otherRefreshes = 0;
  const reactivity = subject.connection.runtime.runSync(Reactivity.Reactivity);
  const stopCurrent = reactivity.registerUnsafe([current], () => {
    currentRefreshes++;
  });
  const stopOther = reactivity.registerUnsafe([other], () => {
    otherRefreshes++;
  });
  try {
    subject.live()?.onNotice({ type: 'worktree', ...scope, change: 'files' });
    await Promise.resolve();
    expect(inventoryRefreshes).toBe(1);
    expect(currentRefreshes).toBe(1);
    expect(otherRefreshes).toBe(0);
  } finally {
    unregister();
    stopCurrent();
    stopOther();
    await subject.cleanup();
  }
});

const owned = new Set<ManagedRuntime.ManagedRuntime<OperationStore, never>>();
afterEach(async () => {
  const runtimes = [...owned];
  owned.clear();
  await Promise.all(runtimes.map((runtime) => runtime.dispose()));
});

function operationStoreFixture(
  persistence?: {
    key: string;
    storage: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  },
  storage?: Context.Service.Shape<typeof OperationStorage>,
) {
  const runtime = ManagedRuntime.make(
    operationStoreLayer.pipe(
      Layer.provide(
        Layer.succeed(
          OperationStorage,
          storage ?? {
            read: () =>
              Effect.try(
                () => persistence?.storage.getItem(persistence.key) ?? null,
              ),
            write: (value) =>
              Effect.try(() =>
                persistence?.storage.setItem(persistence.key, value),
              ),
            clear: () =>
              Effect.try(() =>
                persistence?.storage.removeItem(persistence.key),
              ),
          },
        ),
      ),
    ),
  );
  owned.add(runtime);
  return { runtime, store: runtime.runSync(OperationStore) };
}

it('inventory updates change the live project subscription', async () => {
  const initial = Promise.withResolvers<void>();
  const refreshed = Promise.withResolvers<void>();
  const another = '33333333-3333-4333-8333-333333333333';
  let reads = 0;
  const subject = await setup(
    () => {
      reads += 1;
      return Promise.resolve(
        Response.json({
          environmentId,
          environment: { name: 'Live', custom: false },
          projects: (reads === 1 ? [projectId] : [projectId, another]).map(
            (id) => ({
              id,
              name: id === projectId ? 'First' : 'Second',
              available: true,
              worktrees: [],
            }),
          ),
        }),
      );
    },
    (subscription) => {
      if (subscription.projects.length === 1) initial.resolve();
      if (subscription.projects.length === 2) refreshed.resolve();
    },
  );
  try {
    await initial.promise;
    expect(subject.sent.at(-1)?.projects).toEqual([projectId]);
    subject.live()?.onNotice({ type: 'inventory' });
    await refreshed.promise;
    expect(subject.sent.at(-1)?.projects).toEqual([projectId, another]);
    expect(reads).toBe(2);
  } finally {
    await subject.cleanup();
  }
});

it('a project preference notice refreshes its preferences while leaving inventory untouched', async () => {
  let preferences = 0;
  let inventories = 0;
  const subject = await setup((path) => {
    if (path.endsWith('/file-preferences')) {
      preferences += 1;
      return Promise.resolve(
        Response.json({
          preferences: [
            { path: 'README.md', hidden: preferences > 1, pinned: false },
          ],
        }),
      );
    }
    inventories += 1;
    return Promise.resolve(
      Response.json({
        environmentId,
        environment: { name: 'Live', custom: false },
        projects: [],
      }),
    );
  });
  const state = readFilePreferences({
    connection: subject.connection,
    projectId,
  });
  const stop = subject.registry.mount(state);
  const read = () =>
    Effect.runPromise(
      AtomRegistry.getResult(subject.registry, state, {
        suspendOnWaiting: true,
      }),
    );
  try {
    await subject.subscribed;
    expect((await read()).preferences[0]?.hidden).toBe(false);
    subject
      .live()
      ?.onNotice({ type: 'project', projectId, change: 'preferences' });
    expect((await read()).preferences[0]?.hidden).toBe(true);
    expect(preferences).toBe(2);
    expect(inventories).toBe(1);
  } finally {
    stop();
    await subject.cleanup();
  }
});

it('native file reads subscribe their paths, refresh from a live notice and release their watches on unmount', async () => {
  const worktreeId = '0123456789abcdef0123456789abcdef';
  const followed = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  let watched = false;
  let reads = 0;
  const subject = await setup(
    (path) => {
      if (path.endsWith('/text?path=README.md')) {
        reads += 1;
        return Promise.resolve(
          Response.json({
            worktreeId,
            path: 'README.md',
            encoding: 'utf-8',
            byteLength: 5,
            text: reads === 1 ? 'First' : 'After',
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          environmentId,
          environment: { name: 'Live', custom: false },
          projects: [],
        }),
      );
    },
    (subscription) => {
      if (
        subscription.worktrees.some(
          (entry) =>
            entry.worktreeId === worktreeId &&
            entry.paths.includes('README.md'),
        )
      ) {
        watched = true;
        followed.resolve();
      } else if (watched && subscription.worktrees.length === 0)
        released.resolve();
    },
  );
  const state = readTextFile({
    connection: subject.connection,
    scope: { projectId, worktreeId },
    path: 'README.md',
  });
  const stop = subject.registry.mount(state);
  const read = () =>
    Effect.runPromise(
      AtomRegistry.getResult(subject.registry, state, {
        suspendOnWaiting: true,
      }),
    );
  try {
    await followed.promise;
    expect(await read()).toMatchObject({ text: 'First' });
    subject
      .live()
      ?.onNotice({ type: 'worktree', projectId, worktreeId, change: 'files' });
    expect(await read()).toMatchObject({ text: 'After' });
    expect(reads).toBe(2);
    stop();
    await released.promise;
    expect(subject.sent.at(-1)?.worktrees).toEqual([]);
  } finally {
    stop();
    await subject.cleanup();
  }
});
