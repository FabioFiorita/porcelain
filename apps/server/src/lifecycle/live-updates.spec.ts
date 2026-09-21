import {
  type AsyncSubscription,
  type Event,
  subscribe as nativeSubscribe,
  type Options,
} from '@parcel/watcher';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReviewedFileStore } from '../repositories/interfaces/reviewed-file-store.ts';
import type { ResolveWorktree } from '../use-cases/resolve-worktree.ts';
import { LiveUpdates } from './live-updates.ts';

const projectId = '00000000-0000-4000-8000-000000000001';
const worktreeId = 'a'.repeat(32);
const execFile = promisify(execFileCallback);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

it('shares worktree and project watchers, groups bursts, and releases the last client', async () => {
  vi.useFakeTimers();
  const roots: {
    root: string;
    callback(error: Error | null, events: Event[]): unknown;
    options: Options | undefined;
    unsubscribe: ReturnType<typeof vi.fn<() => Promise<void>>>;
  }[] = [];
  const watcher = {
    subscribe: vi.fn(
      async (
        root: string,
        callback: (error: Error | null, events: Event[]) => unknown,
        options?: Options,
      ): Promise<AsyncSubscription> => {
        const unsubscribe = vi.fn(async () => undefined);
        roots.push({ root, callback, options, unsubscribe });
        return { unsubscribe };
      },
    ),
  };
  const reviewed = {
    list: vi.fn(() => []),
    set: vi.fn(),
    remove: vi.fn(),
    invalidate: vi.fn(),
    reconcile: vi.fn(),
  } satisfies ReviewedFileStore;
  const worktrees = {
    inProject: vi.fn(async () => ({
      id: worktreeId,
      projectId,
      path: '/fixture/worktree',
      commonDirectory: '/fixture/repository.git',
      repositoryIdentity: 'repository',
      metadataIdentity: 'metadata',
      branch: 'refs/heads/main',
      main: true,
      available: true,
      administrativeDirectory: '/fixture/repository.git',
    })),
  } as unknown as ResolveWorktree;
  const live = new LiveUpdates({
    worktrees,
    reviewed,
    watcher,
    ignoredPaths: async () => ['node_modules'],
    projects: () => [
      {
        id: projectId,
        commonDirectory: '/fixture/repository.git',
        repositoryIdentity: 'repository',
      },
    ],
  });
  const firstNotices: unknown[] = [];
  const secondNotices: unknown[] = [];
  const first = live.connect((notice) => firstNotices.push(notice));
  const second = live.connect((notice) => secondNotices.push(notice));
  const subscription = {
    type: 'subscribe' as const,
    projects: [projectId],
    worktrees: [{ projectId, worktreeId, paths: [] }],
  };
  await first.subscribe(subscription);
  await second.subscribe(subscription);

  expect(watcher.subscribe).toHaveBeenCalledTimes(2);
  expect(roots.map((entry) => entry.root).sort()).toEqual([
    '/fixture/repository.git',
    '/fixture/worktree',
  ]);
  const worktree = roots.find((entry) => entry.root === '/fixture/worktree');
  if (!worktree) throw new Error('Missing worktree watcher');
  expect(worktree.options?.ignore).toEqual([
    '/fixture/worktree/.git',
    '/fixture/worktree/node_modules',
  ]);
  worktree.callback(null, [
    { type: 'update', path: '/fixture/worktree/src/a.ts' },
    { type: 'update', path: '/fixture/worktree/src/b.ts' },
  ]);
  await vi.advanceTimersByTimeAsync(149);
  expect(reviewed.invalidate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(reviewed.invalidate).toHaveBeenCalledWith(worktreeId, [
    'src/a.ts',
    'src/b.ts',
  ]);
  expect(firstNotices).toContainEqual({
    type: 'worktree',
    projectId,
    worktreeId,
    change: 'files',
  });
  expect(secondNotices).toContainEqual({
    type: 'worktree',
    projectId,
    worktreeId,
    change: 'files',
  });

  first.close();
  expect(
    roots.every((entry) => entry.unsubscribe.mock.calls.length === 0),
  ).toBe(true);
  second.close();
  await vi.waitFor(() =>
    expect(
      roots.every((entry) => entry.unsubscribe.mock.calls.length === 1),
    ).toBe(true),
  );
  await live.close();
});

it('watches registered project metadata with no selected worktree', async () => {
  vi.useFakeTimers();
  let callback: ((error: Error | null, events: Event[]) => unknown) | undefined;
  const live = new LiveUpdates({
    worktrees: {} as ResolveWorktree,
    reviewed: {
      list: () => [],
      set: vi.fn(),
      remove: vi.fn(),
      invalidate: vi.fn(),
      reconcile: vi.fn(),
    },
    watcher: {
      subscribe: async (_root, listener) => {
        callback = listener;
        return { unsubscribe: async () => undefined };
      },
    },
    projects: () => [
      {
        id: projectId,
        commonDirectory: '/fixture/repository.git',
        repositoryIdentity: 'repository',
      },
    ],
  });
  const notices: unknown[] = [];
  const client = live.connect((notice) => notices.push(notice));
  await client.subscribe({
    type: 'subscribe',
    projects: [projectId],
    worktrees: [],
  });
  callback?.(null, [
    { type: 'create', path: '/fixture/repository.git/worktrees/new' },
  ]);
  await vi.advanceTimersByTimeAsync(150);
  expect(notices).toContainEqual({ type: 'inventory' });
  client.close();
  await live.close();
});

it('shares one native registry when first clients subscribe concurrently', async () => {
  const first = deferred<AsyncSubscription>();
  const unsubscribes: ReturnType<typeof vi.fn<() => Promise<void>>>[] = [];
  const watcher = {
    subscribe: vi.fn(async () => {
      const unsubscribe = vi.fn(async () => undefined);
      unsubscribes.push(unsubscribe);
      if (watcher.subscribe.mock.calls.length === 1) return first.promise;
      return { unsubscribe };
    }),
  };
  const live = new LiveUpdates({
    worktrees: {
      inProject: vi.fn(async () => ({
        id: worktreeId,
        projectId,
        path: '/fixture/worktree',
        commonDirectory: '/fixture/repository.git',
      })),
    } as unknown as ResolveWorktree,
    reviewed: {
      list: () => [],
      set: vi.fn(),
      remove: vi.fn(),
      invalidate: vi.fn(),
      reconcile: vi.fn(),
    },
    watcher,
    ignoredPaths: async () => [],
    projects: () => [
      {
        id: projectId,
        commonDirectory: '/fixture/repository.git',
        repositoryIdentity: 'repository',
      },
    ],
  });
  const a = live.connect(() => undefined);
  const b = live.connect(() => undefined);
  const value = {
    type: 'subscribe' as const,
    projects: [projectId],
    worktrees: [{ projectId, worktreeId, paths: [] }],
  };
  const aReady = a.subscribe(value);
  const bReady = b.subscribe(value);
  await vi.waitFor(() => expect(watcher.subscribe).toHaveBeenCalledTimes(1));
  const firstUnsubscribe = unsubscribes[0];
  if (!firstUnsubscribe) throw new Error('Missing first native subscription');
  first.resolve({ unsubscribe: firstUnsubscribe });
  await Promise.all([aReady, bReady]);

  expect(watcher.subscribe).toHaveBeenCalledTimes(2);
  a.close();
  b.close();
  await live.close();
  expect(
    unsubscribes.every((unsubscribe) => unsubscribe.mock.calls.length === 1),
  ).toBe(true);
});

it('releases a native subscription that resolves after its client closes', async () => {
  const pending = deferred<AsyncSubscription>();
  const unsubscribe = vi.fn(async () => undefined);
  const subscribe = vi.fn(async () => pending.promise);
  const live = new LiveUpdates({
    worktrees: {} as ResolveWorktree,
    reviewed: {
      list: () => [],
      set: vi.fn(),
      remove: vi.fn(),
      invalidate: vi.fn(),
      reconcile: vi.fn(),
    },
    watcher: { subscribe },
    projects: () => [
      {
        id: projectId,
        commonDirectory: '/fixture/repository.git',
        repositoryIdentity: 'repository',
      },
    ],
  });
  const client = live.connect(() => undefined);
  const ready = client.subscribe({
    type: 'subscribe',
    projects: [projectId],
    worktrees: [],
  });
  await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
  client.close();
  pending.resolve({ unsubscribe });
  await ready;
  await live.close();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it('keeps healthy projects live when a saved project cannot be watched', async () => {
  vi.useFakeTimers();
  let healthyCallback:
    | ((error: Error | null, events: Event[]) => unknown)
    | undefined;
  const healthyId = '00000000-0000-4000-8000-000000000002';
  const live = new LiveUpdates({
    worktrees: {} as ResolveWorktree,
    reviewed: {
      list: () => [],
      set: vi.fn(),
      remove: vi.fn(),
      invalidate: vi.fn(),
      reconcile: vi.fn(),
    },
    watcher: {
      subscribe: async (root, callback) => {
        if (root === '/missing/repository.git') throw new Error('ENOENT');
        healthyCallback = callback;
        return { unsubscribe: async () => undefined };
      },
    },
    projects: () => [
      {
        id: projectId,
        commonDirectory: '/missing/repository.git',
        repositoryIdentity: 'missing',
      },
      {
        id: healthyId,
        commonDirectory: '/healthy/repository.git',
        repositoryIdentity: 'healthy',
      },
    ],
  });
  const notices: unknown[] = [];
  const client = live.connect((notice) => notices.push(notice));
  await client.subscribe({
    type: 'subscribe',
    projects: [projectId, healthyId],
    worktrees: [],
  });
  healthyCallback?.(null, [
    { type: 'create', path: '/healthy/repository.git/worktrees/new' },
  ]);
  await vi.advanceTimersByTimeAsync(150);
  expect(notices).toContainEqual({ type: 'inventory' });
  client.close();
  await live.close();
});

it('rebuilds the native watch after a directory becomes unignored', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-live-ignore-'));
  await execFile('git', ['init', '--quiet', root]);
  await mkdir(join(root, 'generated'));
  await writeFile(join(root, '.gitignore'), 'generated/\n');
  await writeFile(join(root, 'generated', 'output.txt'), 'ignored\n');
  const notices: unknown[] = [];
  let worktreeSubscriptions = 0;
  const live = new LiveUpdates({
    watcher: {
      subscribe: async (path, callback, options) => {
        const subscription = await nativeSubscribe(path, callback, options);
        if (path === root) worktreeSubscriptions += 1;
        return subscription;
      },
    },
    worktrees: {
      inProject: async () => ({
        id: worktreeId,
        projectId,
        path: root,
        commonDirectory: join(root, '.git'),
      }),
    } as unknown as ResolveWorktree,
    reviewed: {
      list: () => [],
      set: vi.fn(),
      remove: vi.fn(),
      invalidate: vi.fn(),
      reconcile: vi.fn(),
    },
    projects: () => [
      {
        id: projectId,
        commonDirectory: join(root, '.git'),
        repositoryIdentity: 'repository',
      },
    ],
  });
  try {
    const client = live.connect((notice) => notices.push(notice));
    await client.subscribe({
      type: 'subscribe',
      projects: [projectId],
      worktrees: [{ projectId, worktreeId, paths: [] }],
    });
    notices.length = 0;
    await writeFile(join(root, '.gitignore'), '# generated is visible\n');
    await vi.waitFor(
      () =>
        expect(notices).toContainEqual({
          type: 'worktree',
          projectId,
          worktreeId,
          change: 'files',
        }),
      { timeout: 3_000 },
    );
    await vi.waitFor(() => expect(worktreeSubscriptions).toBe(2), {
      timeout: 3_000,
    });
    notices.length = 0;
    await writeFile(join(root, 'generated', 'output.txt'), 'visible\n');
    await vi.waitFor(
      () =>
        expect(notices).toContainEqual({
          type: 'worktree',
          projectId,
          worktreeId,
          change: 'files',
        }),
      { timeout: 3_000 },
    );
    client.close();
  } finally {
    await live.close();
    await rm(root, { recursive: true, force: true });
  }
});

import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
