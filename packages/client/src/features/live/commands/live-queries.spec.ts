import { Layer, ManagedRuntime, type Context } from 'effect';
import { afterEach } from 'vitest';
import { Effect } from 'effect';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { expect, it } from 'vitest';
import {
  createWorktreeConnection,
  queryKeys,
} from '@porcelain/client/transport';
import {
  OperationStore,
  OperationStorage,
  operationKey,
} from '@porcelain/client/git-actions';
import type { RunGitActionRequest } from '@porcelain/contracts/git-actions';
import type { LiveSubscription, LiveUpdatePort } from '../ports/live-update.ts';
import { connectLiveQueries } from './live-queries.ts';

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

function setup() {
  const lifetime = createWorktreeConnection({
    environmentId: 'live',
    transport: () => Promise.reject(new Error('Unexpected HTTP request')),
    timeoutMs: 1000,
  });
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
          subscribed.resolve();
        },
      };
    },
  };
  const close = connectLiveQueries(
    client,
    {
      ...lifetime.connection,
      controller: lifetime.controller,
      operations,
      liveUpdates,
    },
    () => {},
  );
  return {
    ...lifetime,
    operations,
    client,
    sent,
    subscribed: subscribed.promise,
    live: () => live,
    close,
    cleanup: () => {
      close();
      lifetime.close();
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
    subject.cleanup();
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
    subject.cleanup();
  }
});

it('ignores late notices and reconnect callbacks after closing the live session', async () => {
  const subject = setup();
  const key = queryKeys.inventory('live');
  subject.client.setQueryData(key, 'cached');
  try {
    subject.close();
    subject.live()?.onNotice({ type: 'inventory' });
    subject.live()?.onReconnect();
    await Promise.resolve();
    expect(subject.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(subject.sent).toEqual([]);
  } finally {
    subject.cleanup();
  }
});

it('a file notice invalidates only the connected environment', async () => {
  const subject = setup();
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
    expect(subject.client.getQueryState(current)?.isInvalidated).toBe(true);
    expect(subject.client.getQueryState(other)?.isInvalidated).toBe(false);
  } finally {
    subject.cleanup();
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
