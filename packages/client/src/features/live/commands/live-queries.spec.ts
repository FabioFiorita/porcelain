import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { readFilePreferences } from '@porcelain/client/projects';
import { Equal, Layer, ManagedRuntime, type Context } from 'effect';
import { afterEach } from 'vitest';
import { Effect } from 'effect';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
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
import { connectLiveQueries } from './live-queries.ts';

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

function setup(
  transport?: Transport,
  onSubscription?: (subscription: LiveSubscription) => void,
) {
  const lifetime = createWorktreeConnection({
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
  });
  const registry = AtomRegistry.make();
  const client = new QueryClient();
  const { store: operations } = operationStoreFixture();
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
  const close = connectLiveQueries(client, connection, () => {}, registry);
  return {
    ...lifetime,
    connection,
    registry,
    operations,
    client,
    sent,
    subscribed: subscribed.promise,
    live: () => live,
    close,
    cleanup: async () => {
      close();
      registry.dispose();
      await lifetime.close();
      client.clear();
    },
  };
}

it('keeps pending operations subscribed within the server limit and retains their active paths', async () => {
  const subject = setup();
  const unsubscribe: (() => void)[] = [];
  const pendingTree = '00000000000000000000000000000020';
  try {
    for (let index = 0; index < 33; index += 1) {
      const worktreeId = index.toString(16).padStart(32, '0');
      const key = queryKeys.worktreeSurface(
        subject.connection,
        { projectId, worktreeId },
        ['text', `file-${index}.ts`],
      );
      subject.client.setQueryData(key, 'cached');
      unsubscribe.push(
        new QueryObserver(subject.client, {
          queryKey: key,
          staleTime: Infinity,
        }).subscribe(() => {}),
      );
    }
    const scope = { projectId, worktreeId: pendingTree };
    await Effect.runPromise(
      subject.operations.set(operationKey(scope, 'fetch'), {
        ...scope,
        requestId,
        request,
      }),
    );
    await subject.subscribed;
    expect(subject.sent).toHaveLength(1);
    expect(subject.sent[0]?.worktrees).toHaveLength(32);
    expect(subject.sent[0]?.worktrees[0]).toEqual({
      ...scope,
      paths: ['file-32.ts'],
    });
    expect(
      subject.sent[0]?.worktrees.some(
        (entry) => entry.worktreeId === '0000000000000000000000000000001f',
      ),
    ).toBe(false);
  } finally {
    for (const stop of unsubscribe) stop();
    await subject.cleanup();
  }
});

it('does not send a queued subscription after the live session closes', async () => {
  const subject = setup();
  try {
    subject.close();
    await Promise.resolve();
    expect(subject.sent).toEqual([]);
    expect(subject.live()?.signal.aborted).toBe(true);
  } finally {
    await subject.cleanup();
  }
});

it('ignores late notices and reconnect callbacks after closing the live session', async () => {
  const subject = setup();
  let refreshes = 0;
  const unregister = subject.connection.runtime
    .runSync(Reactivity.Reactivity)
    .registerUnsafe([queryKeys.inventory(environmentId)], () => {
      refreshes += 1;
    });
  try {
    subject.close();
    subject.live()?.onNotice({ type: 'inventory' });
    subject.live()?.onReconnect();
    await Promise.resolve();
    expect(refreshes).toBe(0);
    expect(subject.sent).toEqual([]);
  } finally {
    unregister();
    await subject.cleanup();
  }
});

it('a file notice invalidates only the connected environment', async () => {
  const subject = setup();
  let inventoryRefreshes = 0;
  const unregister = subject.connection.runtime
    .runSync(Reactivity.Reactivity)
    .registerUnsafe([queryKeys.inventory(environmentId)], () => {
      inventoryRefreshes += 1;
    });
  const scope = { projectId, worktreeId: '00000000000000000000000000000001' };
  const current = queryKeys.worktreeSurface(subject.connection, scope, [
    'text',
    'file.ts',
  ]);
  const other = queryKeys.reviewSurface('other', scope, ['text', 'file.ts']);
  subject.client.setQueryData(current, 'current');
  subject.client.setQueryData(other, 'other');
  try {
    subject.live()?.onNotice({ type: 'worktree', ...scope, change: 'files' });
    await Promise.resolve();
    expect(inventoryRefreshes).toBe(1);
    expect(subject.client.getQueryState(current)?.isInvalidated).toBe(true);
    expect(subject.client.getQueryState(other)?.isInvalidated).toBe(false);
  } finally {
    unregister();
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
    OperationStore.layer.pipe(
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

it('native inventory updates change the live project subscription without a legacy inventory cache', async () => {
  const initial = Promise.withResolvers<void>();
  const refreshed = Promise.withResolvers<void>();
  const another = '33333333-3333-4333-8333-333333333333';
  let reads = 0;
  const subject = setup(
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
    expect(subject.client.getQueryCache().findAll()).toEqual([]);
  } finally {
    await subject.cleanup();
  }
});

it('a project preference notice refreshes its native preferences while leaving inventory and legacy review reads untouched', async () => {
  let preferences = 0;
  let inventories = 0;
  const subject = setup((path) => {
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
    expect(subject.client.getQueryCache().findAll()).toEqual([]);
  } finally {
    stop();
    await subject.cleanup();
  }
});
