import { nativeOperation, nativeWrite } from '@porcelain/effects';
import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit } from 'effect';
import {
  WorktreeChangedError,
  WorktreeNotFoundError,
} from '@porcelain/kernel/errors';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { LaneKeys } from './lane-keys.ts';
import { Lanes } from './lanes.ts';
import { WorktreeAccess } from './worktree-access.ts';

const worktree: ListedWorktree = {
  id: 'tree',
  projectId: 'project',
  repositoryId: 'repository',
  path: '/repo',
  branch: 'refs/heads/main',
  main: true,
  available: true,
  metadataIdentity: 'metadata',
  administrativeDirectory: '/repo/.git',
  commonDirectory: '/repo/.git',
  repositoryIdentity: 'identity',
};

describe('worktree admission', () => {
  it('refuses a queued read before touching a worktree that changed while waiting', async () => {
    const holding = Promise.withResolvers<void>();
    const checked = Promise.withResolvers<void>();
    let changed = false;
    let reads = 0;
    const consistency = {
      execute: () =>
        Effect.suspend(() =>
          changed ? Effect.fail(new WorktreeChangedError()) : Effect.void,
        ),
    };
    const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
    const access = new WorktreeAccess(
      {
        execute: () => {
          checked.resolve();
          return Effect.succeed(worktree);
        },
      },
      consistency,
      lanes,
      new LaneKeys(),
    );
    const writer = Effect.runPromise(
      lanes.run('repository', 'write', () =>
        nativeOperation(() => holding.promise),
      ),
    );
    const read = Effect.runPromiseExit(
      access.read('tree', () =>
        Effect.sync(() => {
          reads += 1;
          return 'text';
        }),
      ),
    );
    await checked.promise;
    changed = true;
    holding.resolve();
    await writer;
    const exit = await read;
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
      WorktreeChangedError,
    );
    expect(reads).toBe(0);
    await lanes.close();
  });

  it('refuses publication if identity changes during a read', async () => {
    let changed = false;
    const consistency = {
      execute: () =>
        Effect.suspend(() =>
          changed ? Effect.fail(new WorktreeChangedError()) : Effect.void,
        ),
    };
    const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
    const access = new WorktreeAccess(
      { execute: () => Effect.succeed(worktree) },
      consistency,
      lanes,
      new LaneKeys(),
    );
    const exit = await Effect.runPromiseExit(
      access.read('tree', () =>
        Effect.sync(() => {
          changed = true;
          return 'stale';
        }),
      ),
    );
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
      WorktreeChangedError,
    );
    await lanes.close();
  });

  it('requires an available project for writes and passes the checked identity', async () => {
    const requests: Parameters<CheckWorktreeUseCasePort['execute']>[0][] = [];
    const consistency = { execute: () => Effect.void };
    const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
    const access = new WorktreeAccess(
      {
        execute: (input) => {
          requests.push(input);
          return Effect.succeed(worktree);
        },
      },
      consistency,
      lanes,
      new LaneKeys(),
    );
    await expect(
      Effect.runPromise(
        access.write('tree', (selected) =>
          Effect.succeed(selected.repositoryId),
        ),
      ),
    ).resolves.toBe('repository');
    expect(requests).toEqual([
      { worktreeId: 'tree', requireAvailableProject: true },
    ]);
    await lanes.close();
  });

  it('keeps a missing worktree in the failure channel and unexpected faults as defects', async () => {
    const consistency = { execute: () => Effect.void };
    const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
    const missing = new WorktreeNotFoundError();
    const expected = new WorktreeAccess(
      { execute: () => Effect.fail(missing) },
      consistency,
      lanes,
      new LaneKeys(),
    );
    const exit = await Effect.runPromiseExit(
      expected.read('tree', () => Effect.succeed('unreachable')),
    );
    expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(true);
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(missing);
    const fault = new Error('Database unavailable');
    const unexpected = new WorktreeAccess(
      { execute: () => Effect.die(fault) },
      consistency,
      lanes,
      new LaneKeys(),
    );
    const crashed = await Effect.runPromiseExit(
      unexpected.read('tree', () => Effect.succeed('unreachable')),
    );
    expect(Exit.isFailure(crashed) && Cause.hasDies(crashed.cause)).toBe(true);
    expect(Exit.isFailure(crashed) && Cause.squash(crashed.cause)).toBe(fault);
    await lanes.close();
  });
});

it('publishes a confirmed filesystem commit after cancellation and native cleanup release its lease', async () => {
  const committed = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<string>();
  const published = Promise.withResolvers<void>();
  const consistency = { execute: () => Effect.void };
  const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
  const access = new WorktreeAccess(
    { execute: () => Effect.succeed(worktree) },
    consistency,
    lanes,
    new LaneKeys(),
  );
  const order: string[] = [];
  const controller = new AbortController();
  const caller = Effect.runPromiseExit(
    access.write(
      'tree',
      () =>
        nativeWrite('tree', (_signal, confirm) => {
          order.push('commit');
          confirm();
          committed.resolve();
          return cleanup.promise.then((value) => {
            order.push('cleanup');
            return value;
          });
        }),
      () =>
        access
          .reviews('tree', 'write', () =>
            Effect.sync(() => {
              order.push('published');
              published.resolve();
            }),
          )
          .pipe(Effect.orDie),
    ),
    { signal: controller.signal },
  );
  await committed.promise;
  controller.abort();
  expect(Exit.isFailure(await caller)).toBe(true);
  expect(order).toEqual(['commit']);
  cleanup.resolve('saved');
  await published.promise;
  expect(order).toEqual(['commit', 'cleanup', 'published']);
  await lanes.close();
});

it('publishes a confirmed filesystem change even when later cleanup fails', async () => {
  const consistency = { execute: () => Effect.void };
  const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
  const access = new WorktreeAccess(
    { execute: () => Effect.succeed(worktree) },
    consistency,
    lanes,
    new LaneKeys(),
  );
  let notifications = 0;
  const failure = new Error('Cannot close the written handle');
  const exit = await Effect.runPromiseExit(
    access.write(
      'tree',
      () =>
        nativeWrite('tree', (_signal, confirm) => {
          confirm();
          return Promise.reject(failure);
        }),
      () =>
        Effect.sync(() => {
          notifications += 1;
        }),
    ),
  );
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(failure);
  expect(notifications).toBe(1);
  await lanes.close();
});

it('refuses a review commit if worktree identity changes during preparation', async () => {
  let changed = false;
  let writes = 0;
  let publications = 0;
  const consistency = {
    execute: () =>
      Effect.suspend(() =>
        changed ? new WorktreeChangedError() : Effect.void,
      ),
  };
  const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
  const access = new WorktreeAccess(
    { execute: () => Effect.succeed(worktree) },
    consistency,
    lanes,
    new LaneKeys(),
  );
  const exit = await Effect.runPromiseExit(
    access.transaction(
      'tree',
      () =>
        Effect.sync(() => {
          changed = true;
          return 'prepared';
        }),
      () =>
        Effect.sync(() => {
          writes += 1;
        }),
      () =>
        Effect.sync(() => {
          publications += 1;
        }),
    ),
  );
  expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(
    WorktreeChangedError,
  );
  expect(writes).toBe(0);
  expect(publications).toBe(0);
  await lanes.close();
});

it('does not publish a cancelled filesystem operation that never committed', async () => {
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const consistency = { execute: () => Effect.void };
  const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
  const access = new WorktreeAccess(
    { execute: () => Effect.succeed(worktree) },
    consistency,
    lanes,
    new LaneKeys(),
  );
  let publications = 0;
  const controller = new AbortController();
  const caller = Effect.runPromiseExit(
    access.write(
      'tree',
      () =>
        nativeWrite('tree', (signal) => {
          signal.addEventListener('abort', () => aborted.resolve(), {
            once: true,
          });
          started.resolve();
          return cleanup.promise;
        }),
      () =>
        Effect.sync(() => {
          publications += 1;
        }),
    ),
    { signal: controller.signal },
  );
  await started.promise;
  controller.abort();
  await aborted.promise;
  expect(Exit.hasInterrupts(await caller)).toBe(true);
  cleanup.resolve();
  await lanes.close();
  expect(publications).toBe(0);
});
