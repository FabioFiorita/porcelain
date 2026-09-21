import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { createMockStore } from '../api/inventory/mock';
import type { LiveUpdatePort } from '../api/live-updates/port';
import { createMockApi } from '../api/mock-api';
import type { Receipt } from '../domain/git-action';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import {
  applyLiveNotice,
  connectLiveQueries,
  liveSubscription,
} from './live-updates';
import { createOperationStore, operationKey } from './operation-store';

const environmentId = '00000000-0000-4000-8000-000000000001';
const projectId = '00000000-0000-4000-8000-000000000002';
const otherProjectId = '00000000-0000-4000-8000-000000000003';
const worktreeId = 'a'.repeat(32);
const otherWorktreeId = 'b'.repeat(32);
const scope = { projectId, worktreeId } satisfies ReviewScope;

function observe(
  client: QueryClient,
  queryKey: readonly unknown[],
  read: () => unknown,
) {
  client.setQueryData(queryKey, { seeded: true });
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: async () => read(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  return unsubscribe;
}

it('invalidates mutable file surfaces and the sidebar without rereading commits or unrelated worktrees', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const reads = {
    changes: vi.fn(() => ({ changes: [] })),
    text: vi.fn(() => ({ text: 'new' })),
    inventory: vi.fn(() => ({ environmentId, projects: [] })),
    comments: vi.fn(() => []),
    commit: vi.fn(() => ({ files: [] })),
    other: vi.fn(() => ({ changes: [] })),
  };
  const subscriptions = [
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['changes']),
      reads.changes,
    ),
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['text', 'src/a.ts']),
      reads.text,
    ),
    observe(client, queryKeys.inventory(environmentId), reads.inventory),
    observe(client, queryKeys.comments(environmentId, scope), reads.comments),
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['commit', 'abc', 1]),
      reads.commit,
    ),
    observe(
      client,
      queryKeys.reviewSurface(
        environmentId,
        { projectId: otherProjectId, worktreeId: otherWorktreeId },
        ['changes'],
      ),
      reads.other,
    ),
  ];
  await applyLiveNotice(client, environmentId, {
    type: 'worktree',
    projectId,
    worktreeId,
    change: 'files',
  });

  expect(reads.changes).toHaveBeenCalledOnce();
  expect(reads.text).toHaveBeenCalledOnce();
  expect(reads.inventory).toHaveBeenCalledOnce();
  expect(reads.comments).not.toHaveBeenCalled();
  expect(reads.commit).not.toHaveBeenCalled();
  expect(reads.other).not.toHaveBeenCalled();
  for (const unsubscribe of subscriptions) unsubscribe();
});

it('subscribes every inventory project and includes active ignored-file paths', () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.inventory(environmentId), {
    environmentId,
    projects: [{ id: projectId }, { id: otherProjectId }],
  });
  const unsubscribe = observe(
    client,
    queryKeys.reviewSurface(environmentId, scope, ['text', '.private/token']),
    () => ({ text: 'secret' }),
  );

  expect(liveSubscription(client, environmentId)).toEqual({
    type: 'subscribe',
    projects: [projectId, otherProjectId],
    worktrees: [{ projectId, worktreeId, paths: ['.private/token'] }],
  });
  unsubscribe();
});

it('refreshes publication, step code and layer marks together after a file notice', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const reads = ['review', 'step-lines', 'reviewed-layers'].map((surface) => ({
    surface,
    read: vi.fn(() => ({})),
  }));
  const unsubscribes = reads.map(({ surface, read }) =>
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, [surface]),
      read,
    ),
  );
  await applyLiveNotice(client, environmentId, {
    type: 'worktree',
    projectId,
    worktreeId,
    change: 'files',
  });
  for (const { read } of reads) expect(read).toHaveBeenCalledOnce();
  for (const unsubscribe of unsubscribes) unsubscribe();
});

it('invalidates review and sidebar state after a terminal Git receipt', async () => {
  const client = new QueryClient();
  const inventory = vi.fn(() => ({ environmentId, projects: [] }));
  const changes = vi.fn(() => ({ changes: [] }));
  const subscriptions = [
    observe(client, queryKeys.inventory(environmentId), inventory),
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['changes']),
      changes,
    ),
  ];
  try {
    await applyLiveNotice(client, environmentId, {
      type: 'git-action',
      ...scope,
      receipt: {
        ...scope,
        requestId: 'request',
        action: 'fetch',
        state: 'running',
        progress: [],
        acceptedAt: 1,
      },
    });
    expect(inventory).not.toHaveBeenCalled();
    expect(changes).not.toHaveBeenCalled();
    await applyLiveNotice(client, environmentId, {
      type: 'git-action',
      ...scope,
      receipt: {
        ...scope,
        requestId: 'request',
        action: 'fetch',
        state: 'interrupted',
        progress: [],
        acceptedAt: 1,
        finishedAt: 2,
      },
    });
    expect(inventory).toHaveBeenCalledOnce();
    expect(changes).toHaveBeenCalledOnce();
  } finally {
    for (const unsubscribe of subscriptions) unsubscribe();
    client.clear();
  }
});

it('keeps an in-flight worktree subscribed after navigation and recovers its completion on reconnect', async () => {
  const client = new QueryClient();
  const controller = new AbortController();
  const operations = createOperationStore();
  const key = operationKey(scope, 'fetch');
  const input = {
    action: 'fetch' as const,
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
  };
  operations.set(key, {
    ...scope,
    requestId: 'request',
    request: {
      requestId: 'request',
      input,
      expected: {
        inProgress: null,
        mergeHeadOid: null,
        headOid: null,
        branch: 'main',
        upstreamOid: null,
      },
    },
  });
  const api = createMockApi(createMockStore());
  const subscribe = vi.fn();
  let handlers: Parameters<LiveUpdatePort['connect']>[0] | undefined;
  api.liveUpdates.connect = (options) => {
    handlers = options;
    return { subscribe };
  };
  const final: Receipt = {
    ...scope,
    requestId: 'request',
    action: 'fetch',
    state: 'succeeded',
    progress: ['Done'],
    acceptedAt: 1,
    finishedAt: 2,
  };
  api.gitActions.receipt = vi.fn(async () => final);
  const disconnect = connectLiveQueries(api, client, {
    environmentId,
    controller,
    operations,
  });
  try {
    await vi.waitFor(() =>
      expect(subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ worktrees: [{ ...scope, paths: [] }] }),
      ),
    );
    const finished = operations.wait(key, controller.signal);
    handlers?.onReconnect();
    expect(await finished).toEqual(final);
    expect(api.gitActions.receipt).toHaveBeenCalledWith(
      expect.objectContaining({ ...scope, requestId: 'request' }),
    );
  } finally {
    disconnect();
    controller.abort();
    client.clear();
  }
});
